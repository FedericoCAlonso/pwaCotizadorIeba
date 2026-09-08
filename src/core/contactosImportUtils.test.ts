import { describe, it, expect } from 'vitest';
import {
  autoDetectContactosColumnMapping,
  normalizeCondicionIVA,
  normalizeRoles,
  normalizeCuitDni,
  parseCSVText,
  validateAndBuildContactosPreview,
  generateContactosCsvTemplate
} from './contactosImportUtils';
import { Contacto } from './types';

describe('contactosImportUtils', () => {
  describe('autoDetectContactosColumnMapping', () => {
    it('detecta cabeceras estándar de Razón Social, CUIT, Teléfono, Email y Rol', () => {
      const headers = ['Razón Social', 'CUIT/DNI', 'Condición IVA', 'Rol', 'Teléfono', 'Email', 'Dirección'];
      const mapping = autoDetectContactosColumnMapping(headers);

      expect(mapping.razonSocial).toBe('Razón Social');
      expect(mapping.cuitDni).toBe('CUIT/DNI');
      expect(mapping.condicionIVA).toBe('Condición IVA');
      expect(mapping.roles).toBe('Rol');
      expect(mapping.telefono).toBe('Teléfono');
      expect(mapping.email).toBe('Email');
      expect(mapping.direccion).toBe('Dirección');
    });

    it('detecta variantes léxicas comunes como "Nombre", "Empresa", "Celular", "CUIT"', () => {
      const headers = ['Nombre de Empresa', 'CUIT', 'Celular', 'Correo Electrónico', 'Domicilio', 'Tags'];
      const mapping = autoDetectContactosColumnMapping(headers);

      expect(mapping.razonSocial).toBe('Nombre de Empresa');
      expect(mapping.cuitDni).toBe('CUIT');
      expect(mapping.telefono).toBe('Celular');
      expect(mapping.email).toBe('Correo Electrónico');
      expect(mapping.direccion).toBe('Domicilio');
      expect(mapping.etiquetas).toBe('Tags');
    });

    it('detecta campos de persona de contacto', () => {
      const headers = ['Cliente', 'Persona de Contacto', 'Teléfono Contacto', 'Email Contacto', 'Cargo'];
      const mapping = autoDetectContactosColumnMapping(headers);

      expect(mapping.razonSocial).toBe('Cliente');
      expect(mapping.personaNombre).toBe('Persona de Contacto');
      expect(mapping.personaTelefono).toBe('Teléfono Contacto');
      expect(mapping.personaEmail).toBe('Email Contacto');
      expect(mapping.personaRol).toBe('Cargo');
    });
  });

  describe('normalizeCondicionIVA', () => {
    it('normaliza Responsable Inscripto y sus abreviaturas', () => {
      expect(normalizeCondicionIVA('Responsable Inscripto')).toBe('Responsable Inscripto');
      expect(normalizeCondicionIVA('RI')).toBe('Responsable Inscripto');
      expect(normalizeCondicionIVA('inscripto')).toBe('Responsable Inscripto');
    });

    it('normaliza Monotributo', () => {
      expect(normalizeCondicionIVA('Monotributo')).toBe('Monotributo');
      expect(normalizeCondicionIVA('mono')).toBe('Monotributo');
    });

    it('normaliza Exento y No Responsable', () => {
      expect(normalizeCondicionIVA('Exento')).toBe('Exento');
      expect(normalizeCondicionIVA('no responsable')).toBe('Exento');
    });

    it('retorna Consumidor Final ante valores vacíos o no reconocidos', () => {
      expect(normalizeCondicionIVA('')).toBe('Consumidor Final');
      expect(normalizeCondicionIVA('particular')).toBe('Consumidor Final');
    });
  });

  describe('normalizeRoles', () => {
    it('normaliza roles de cliente, proveedor y ambos', () => {
      expect(normalizeRoles('Cliente')).toEqual(['cliente']);
      expect(normalizeRoles('Proveedor')).toEqual(['proveedor']);
      expect(normalizeRoles('Ambos')).toEqual(['cliente', 'proveedor']);
      expect(normalizeRoles('Cliente y Proveedor')).toEqual(['cliente', 'proveedor']);
    });

    it('usa el rol por defecto si el texto está vacío', () => {
      expect(normalizeRoles('', 'cliente')).toEqual(['cliente']);
      expect(normalizeRoles('', 'proveedor')).toEqual(['proveedor']);
    });
  });

  describe('normalizeCuitDni', () => {
    it('formatea CUIT de 11 dígitos con guiones', () => {
      expect(normalizeCuitDni('20351234567')).toBe('20-35123456-7');
      expect(normalizeCuitDni('30-71234567-8')).toBe('30-71234567-8');
    });

    it('mantiene DNI limpio de 7 u 8 dígitos', () => {
      expect(normalizeCuitDni('35123456')).toBe('35123456');
    });
  });

  describe('parseCSVText', () => {
    it('parsea CSV estándar delimitado por comas con comillas', () => {
      const csv = `Razón Social,CUIT,Teléfono
"ElectroTech S.A.","30-71234567-8","11-4567-8901"
"Gómez, Juan","20-12345678-9","11-6543-2109"`;

      const result = parseCSVText(csv);
      expect(result.headers).toEqual(['Razón Social', 'CUIT', 'Teléfono']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]['Razón Social']).toBe('ElectroTech S.A.');
      expect(result.rows[1]['Razón Social']).toBe('Gómez, Juan');
    });

    it('detecta y parsea CSV delimitado por punto y coma (Excel latinoamericano)', () => {
      const csv = `Razón Social;CUIT;Teléfono\nElectroTech S.A.;30-71234567-8;11-4567-8901\nJuan Pérez;20-11111111-2;11-2222-3333`;
      const result = parseCSVText(csv);

      expect(result.headers).toEqual(['Razón Social', 'CUIT', 'Teléfono']);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0]['Razón Social']).toBe('ElectroTech S.A.');
    });
  });

  describe('validateAndBuildContactosPreview', () => {
    const existingContactos: Contacto[] = [
      {
        id: 'ct-existente-1',
        razonSocial: 'Empresa Existente S.A.',
        cuitDni: '30-11111111-1',
        roles: ['cliente'],
        deleted: false
      }
    ];

    it('identifica contactos nuevos válidos', () => {
      const rows = [
        {
          'Razón Social': 'Nuevo Cliente S.R.L.',
          'CUIT': '30-22222222-2',
          'Rol': 'Cliente'
        }
      ];
      const mapping = autoDetectContactosColumnMapping(['Razón Social', 'CUIT', 'Rol']);

      const preview = validateAndBuildContactosPreview({
        rows,
        mapping,
        existingContactos,
        importStrategy: 'ignore_duplicates'
      });

      expect(preview.newCount).toBe(1);
      expect(preview.updateCount).toBe(0);
      expect(preview.skipCount).toBe(0);
      expect(preview.errorCount).toBe(0);
      expect(preview.rows[0].status).toBe('new');
      expect(preview.rows[0].data.razonSocial).toBe('Nuevo Cliente S.R.L.');
    });

    it('detecta duplicados por CUIT y los omite con estrategia ignore_duplicates', () => {
      const rows = [
        {
          'Razón Social': 'Empresa Existente Modificada',
          'CUIT': '30111111111', // mismo CUIT sin guiones
          'Rol': 'Cliente'
        }
      ];
      const mapping = autoDetectContactosColumnMapping(['Razón Social', 'CUIT', 'Rol']);

      const preview = validateAndBuildContactosPreview({
        rows,
        mapping,
        existingContactos,
        importStrategy: 'ignore_duplicates'
      });

      expect(preview.newCount).toBe(0);
      expect(preview.skipCount).toBe(1);
      expect(preview.rows[0].status).toBe('skip');
      expect(preview.rows[0].existingId).toBe('ct-existente-1');
    });

    it('detecta duplicados por CUIT y los actualiza con estrategia update_existing', () => {
      const rows = [
        {
          'Razón Social': 'Empresa Existente S.A. Renovada',
          'CUIT': '30-11111111-1',
          'Rol': 'Cliente'
        }
      ];
      const mapping = autoDetectContactosColumnMapping(['Razón Social', 'CUIT', 'Rol']);

      const preview = validateAndBuildContactosPreview({
        rows,
        mapping,
        existingContactos,
        importStrategy: 'update_existing'
      });

      expect(preview.updateCount).toBe(1);
      expect(preview.rows[0].status).toBe('update');
      expect(preview.rows[0].existingId).toBe('ct-existente-1');
      expect(preview.rows[0].data.razonSocial).toBe('Empresa Existente S.A. Renovada');
    });

    it('marca error si falta la Razón Social / Nombre', () => {
      const rows = [
        {
          'Razón Social': '   ',
          'CUIT': '30-33333333-3'
        }
      ];
      const mapping = autoDetectContactosColumnMapping(['Razón Social', 'CUIT']);

      const preview = validateAndBuildContactosPreview({
        rows,
        mapping,
        existingContactos,
        importStrategy: 'ignore_duplicates'
      });

      expect(preview.errorCount).toBe(1);
      expect(preview.rows[0].status).toBe('error');
      expect(preview.rows[0].errorMessage).toBeDefined();
    });
  });

  describe('generateContactosCsvTemplate', () => {
    it('genera una plantilla CSV no vacía con cabeceras correctas', () => {
      const tpl = generateContactosCsvTemplate();
      expect(tpl).toContain('Razón Social');
      expect(tpl).toContain('CUIT / DNI');
      expect(tpl).toContain('ElectroTech S.A.');
    });
  });
});
