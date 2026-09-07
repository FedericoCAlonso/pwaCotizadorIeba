import { describe, it, expect } from 'vitest';
import {
  parseDSLToPresupuesto,
  serializePresupuestoToDSL,
  getDefaultPresupuestoYAMLTemplate,
  parseLocalizedNumber,
  normalizeString,
  detectCursorContext,
  detectSuggestTrigger,
  formatSlashCommandReplacement,
  handleYamlSmartEnter,
  handleYamlSmartBackspace,
  scoreSearchMatch,
  preprocessYamlText
} from './dslParser';
import { Cliente, TareaTipo, Insumo, CategoriaManoDeObra, ItemPresupuesto, CapituloPresupuesto } from '../../../core/types';

describe('dslParser (Modo Experto YAML)', () => {
  const mockClientes: Cliente[] = [
    { id: 'cli-1', nombre: 'Federico Gómez', razonSocial: 'Estudio Arq. Gómez', cuitDni: '30-12345678-9', direccion: 'Av. Corrientes 1000', roles: ['cliente'] },
    { id: 'cli-2', nombre: 'Juan Pérez', razonSocial: 'Juan Pérez', cuitDni: '20-98765432-1', direccion: 'Belgrano 450', roles: ['cliente'] }
  ];

  const mockTareas: TareaTipo[] = [
    {
      id: 'tarea-boca',
      nombre: 'Boca de Iluminación',
      unidad: 'u',
      categoria: 'iluminacion',
      insumos: [{ materialId: 'mat-cable', cantidad: 10 }],
      manoObra: [{ categoriaId: 'mo-oficial', horas: 1.5 }]
    },
    {
      id: 'tarea-disyuntor',
      nombre: 'Disyuntor Diferencial 2x40A',
      unidad: 'u',
      categoria: 'tableros',
      insumos: [{ materialId: 'mat-disyuntor', cantidad: 1 }],
      manoObra: [{ categoriaId: 'mo-oficial', horas: 1.0 }]
    }
  ];

  const mockInsumosMap = new Map<string, Insumo>([
    ['mat-cable', { id: 'mat-cable', nombre: 'Cable 2.5mm', precioActual: 200, unidad: 'm', categoria: 'cables' } as unknown as Insumo],
    ['mat-disyuntor', { id: 'mat-disyuntor', nombre: 'Disyuntor 2x40A', precioActual: 25000, unidad: 'u', categoria: 'tableros' } as unknown as Insumo]
  ]);

  const mockManoObraMap = new Map<string, CategoriaManoDeObra>([
    ['mo-oficial', { id: 'mo-oficial', nombre: 'Oficial', costoHora: 5000, fechaActualizacion: '2026-01-01' }],
    ['mo-ayudante', { id: 'mo-ayudante', nombre: 'Ayudante', costoHora: 3500, fechaActualizacion: '2026-01-01' }]
  ]);

  it('parseLocalizedNumber parsea correctamente números con formatos varios', () => {
    expect(parseLocalizedNumber('1.250,50')).toBe(1250.5);
    expect(parseLocalizedNumber('45000')).toBe(45000);
    expect(parseLocalizedNumber('12,5')).toBe(12.5);
    expect(parseLocalizedNumber('$ 35.000')).toBe(35000);
  });

  it('getDefaultPresupuestoYAMLTemplate genera la plantilla inicial comentada', () => {
    const template = getDefaultPresupuestoYAMLTemplate({ clientes: mockClientes });
    expect(template).toContain('# ============================================================');
    expect(template).toContain('cliente: Estudio Arq. Gómez');
    expect(template).toContain('factura: Factura A');
    expect(template).toContain('Instalación Eléctrica:');
    expect(template).toContain('Tableros y Automatización:');
    expect(template).toContain('materiales:');
    expect(template).toContain('mano_obra:');
    expect(template).toContain('gastos:');
  });

  it('parsea directivas de cabecera en YAML y vincula cliente y obra', () => {
    const yaml = `
# Comentario inicial
cliente: Estudio Arq. Gómez
obra: Thames 1850, Palermo
factura: Factura A
validez: 30 dias
margen: 40%
riesgo: alto
dolar: MEP 1300
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.clienteId).toBe('cli-1');
    expect(result.clienteMatched?.razonSocial).toBe('Estudio Arq. Gómez');
    expect(result.direccionObra).toBe('Thames 1850, Palermo');
    expect(result.tipoFactura).toBe('Factura A');
    expect(result.validezDias).toBe(30);
    expect(result.margenPorcentaje).toBe(40);
    expect(result.nivelMargenRiesgo).toBe('alto');
    expect(result.margenRiesgoPorcentaje).toBe(10);
    expect(result.mostrarDolar).toBe(true);
    expect(result.cotizacionDolar).toBe(1300);
  });

  it('parsea capítulos y tareas simples vinculándolas con el catálogo de Tareas Tipo', () => {
    const yaml = `
Iluminación y Fuerza:
  - 10 u Boca de Iluminación
  - 2 u Disyuntor Diferencial 2x40A
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.capitulos.length).toBe(1);
    expect(result.capitulos[0].nombre).toBe('Iluminación y Fuerza');
    expect(result.items.length).toBe(2);

    const itBoca = result.items[0];
    expect(itBoca.descripcion).toBe('Boca de Iluminación');
    expect(itBoca.cantidad).toBe(10);
    expect(itBoca.unidad).toBe('u');
    // APU calculado: Cable (10m * $200 = $2000) + MO (1.5h * $5000 = $7500) = $9500 unitario
    expect(itBoca.costoUnitario).toBe(9500);
    expect(itBoca.costoInsumos).toBe(20000); // 10 bocas * 2000
    expect(itBoca.costoManoObra).toBe(75000); // 10 bocas * 7500
    expect(itBoca.costoDirectoTotal).toBe(95000);
  });

  it('parsea partidas a medida con despiece de materiales y mano de obra', () => {
    const yaml = `
Tableros Especiales:
  - Tablero Seccional Bomba:
      materiales:
        - 2 u Disyuntor 2x40A
        - 1 u Bomba Sumergible 1HP : $ 180.000
      mano_obra:
        - 6 h Oficial
        - 4 h Ayudante
      condicion: dificultosa
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.capitulos.length).toBe(1);
    expect(result.items.length).toBe(1);

    const item = result.items[0];
    expect(item.descripcion).toBe('Tablero Seccional Bomba');
    expect(item.esAdHoc).toBe(true);
    expect(item.condicionTrabajo).toBe('dificultosa');
    expect(item.insumosSnapshot.length).toBe(2);

    // Material 1: Disyuntor 2x40A (del catálogo = $25000 c/u * 2 = $50000)
    expect(item.insumosSnapshot[0].nombre).toBe('Disyuntor 2x40A');
    expect(item.insumosSnapshot[0].precioUnitarioCongelado).toBe(25000);
    expect(item.insumosSnapshot[0].subtotalInsumo).toBe(50000);

    // Material 2: Bomba Sumergible (fuera de catálogo con precio manual = $180000)
    expect(item.insumosSnapshot[1].nombre).toBe('Bomba Sumergible 1HP');
    expect(item.insumosSnapshot[1].precioUnitarioCongelado).toBe(180000);
    expect(item.insumosSnapshot[1].subtotalInsumo).toBe(180000);

    expect(item.costoInsumos).toBe(230000); // 50000 + 180000

    // Mano de Obra:
    // Oficial: 6h * $5000 = $30000
    // Ayudante: 4h * $3500 = $14000
    // Total base MO = $44000. Con condición dificultosa (+20%): 44000 * 1.2 = $52800
    expect(item.manoObraSnapshot.length).toBe(2);
    expect(item.costoManoObra).toBe(52800);

    // Costo directo total = 230000 + 52800 = 282800
    expect(item.costoDirectoTotal).toBe(282800);
  });

  it('reporta error de sintaxis si el YAML tiene indentación incorrecta', () => {
    const brokenYaml = `
cliente: Juan
obra:
  - Thames:
   error_indentacion
    `;

    const result = parseDSLToPresupuesto(brokenYaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    const errorDiag = result.diagnostics.find((d) => d.type === 'error');
    expect(errorDiag).toBeDefined();
    expect(errorDiag?.message).toContain('Error de sintaxis YAML');
  });

  it('serializa un presupuesto a YAML y lo vuelve a parsear bidireccionalmente', () => {
    const capitulos: CapituloPresupuesto[] = [{ id: 'cap-1', nombre: 'Sector Tableros' }];
    const items: ItemPresupuesto[] = [
      {
        id: 'it-1',
        capituloId: 'cap-1',
        tareaTipoId: 'tarea-boca',
        descripcion: 'Boca de Iluminación',
        cantidad: 15,
        unidad: 'u',
        costoUnitario: 9500,
        costoInsumos: 30000,
        costoManoObra: 112500,
        costoDirectoTotal: 142500,
        costoTotal: 142500,
        precioVentaUnitario: 13300,
        precioVentaTotal: 199500,
        insumosSnapshot: [],
        manoObraSnapshot: []
      }
    ];

    const yaml = serializePresupuestoToDSL({
      clienteId: 'cli-1',
      direccionObra: 'Juncal 1234',
      tipoFactura: 'Factura B',
      validezDias: 20,
      margenPorcentaje: 30,
      capitulos,
      items,
      clientes: mockClientes
    });

    expect(yaml).toContain('cliente: Estudio Arq. Gómez');
    expect(yaml).toContain('obra: Juncal 1234');
    expect(yaml).toContain('Sector Tableros:');
    expect(yaml).toContain('- 15 u Boca de Iluminación');

    const parsed = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(parsed.clienteId).toBe('cli-1');
    expect(parsed.direccionObra).toBe('Juncal 1234');
    expect(parsed.capitulos[0].nombre).toBe('Sector Tableros');
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].descripcion).toBe('Boca de Iluminación');
    expect(parsed.items[0].cantidad).toBe(15);
  });

  it('parsea partidas a medida con materiales agrupados por sub-categorías', () => {
    const yaml = `
Tableros:
  - Tablero Categorizado:
      materiales:
        cables:
          - 20 m Cable 2.5mm
        protecciones:
          - 1 u Disyuntor 2x40A
      mano_obra:
        - 4 h Oficial
    `;

    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.insumosSnapshot.length).toBe(2);
    expect(item.insumosSnapshot[0].nombre).toBe('Cable 2.5mm');
    expect(item.insumosSnapshot[0].cantidadTotal).toBe(20);
    expect(item.insumosSnapshot[1].nombre).toBe('Disyuntor 2x40A');
    expect(item.insumosSnapshot[1].cantidadTotal).toBe(1);
    expect(item.manoObraSnapshot.length).toBe(1);
  });

  describe('detectCursorContext', () => {
    it('detecta contexto materiales ignorando comentarios interpuestos', () => {
      const text = `
Instalación Eléctrica:
  - Tablero Principal:
      # Opcional: materiales incluidos en este ítem
      materiales:
        # Podes listar insumos directamente:
        - 25 m Cable Unipolar 2.5 mm
        # Otro comentario
        - `;

      const ctx = detectCursorContext(text);
      expect(ctx.contextType).toBe('materiales');
      expect(ctx.parentHeader).toBe('materiales');
      expect(ctx.currentIndent).toBe('        ');
    });

    it('detecta contexto mano_obra', () => {
      const text = `
Instalación Eléctrica:
  - Tablero Principal:
      mano_obra:
        - `;

      const ctx = detectCursorContext(text);
      expect(ctx.contextType).toBe('mano_obra');
      expect(ctx.parentHeader).toBe('mano_obra');
    });

    it('detecta subcategoría activa bajo materiales', () => {
      const text = `
Instalación Eléctrica:
  - Tablero:
      materiales:
        cables:
          - `;

      const ctx = detectCursorContext(text);
      expect(ctx.contextType).toBe('materiales');
      expect(ctx.activeCategory).toBe('cables');
    });

    it('detecta tareas bajo un capítulo', () => {
      const text = `
Instalación Eléctrica:
  - `;

      const ctx = detectCursorContext(text);
      expect(ctx.contextType).toBe('tareas');
      expect(ctx.parentHeader).toBe('Instalación Eléctrica');
    });

    it('detecta contexto general en la raíz o directivas', () => {
      const text = `cliente: Juan\nobra: `;
      const ctx = detectCursorContext(text);
      expect(ctx.contextType).toBe('general');
    });
  });

  describe('formatSlashCommandReplacement', () => {
    it('reemplaza ítem simple sin duplicar guiones (- -)', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - cab',
        snippet: '- 1 u Cable Unipolar 2.5 mm\n'
      });

      expect(replacementLine).toBe('        - 1 u Cable Unipolar 2.5 mm\n');
      expect(replacementLine).not.toContain('- -');
    });

    it('preserva la cantidad y unidad tipeadas por el usuario al reemplazar', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - 50 m cab',
        snippet: '- 1 u Cable Unipolar 2.5 mm\n'
      });

      expect(replacementLine).toBe('        - 50 m Cable Unipolar 2.5 mm\n');
    });

    it('inserta directivas limpiando barras o prefijos', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '/cliente',
        snippet: 'cliente: '
      });

      expect(replacementLine).toBe('cliente: ');
    });

    it('respeta la indentación existente al insertar tareas', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '  - boc',
        snippet: '- 1 u Boca de Iluminación\n'
      });

      expect(replacementLine).toBe('  - 1 u Boca de Iluminación\n');
    });

    it('reemplaza limpiamente cuando el usuario busca con decimales "- cabl 1.5"', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - cabl 1.5',
        snippet: '- 1 m Cable Unipolar 1.5 mm² Marrón\n'
      });

      expect(replacementLine).toBe('        - 1 m Cable Unipolar 1.5 mm² Marrón\n');
    });

    it('preserva la cantidad si el usuario puso sólo número "- 25 cabl 1.5" y le asigna la unidad del catálogo', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - 25 cabl 1.5',
        snippet: '- 1 m Cable Unipolar 1.5 mm² Marrón\n'
      });

      expect(replacementLine).toBe('        - 25 m Cable Unipolar 1.5 mm² Marrón\n');
    });

    it('preserva cantidad y unidad explícitas "- 25 m cabl 1.5"', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - 25 m cabl 1.5',
        snippet: '- 1 m Cable Unipolar 1.5 mm² Marrón\n'
      });

      expect(replacementLine).toBe('        - 25 m Cable Unipolar 1.5 mm² Marrón\n');
    });
  });

  describe('handleYamlSmartEnter', () => {
    it('corrige la línea de materiales: quitando el guión, sangrando adecuadamente y preparando el siguiente renglón', () => {
      const textBefore = `Instalación Eléctrica:\n  - 10 u Bocas de Iluminacion\n  - materiales:`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      // Debe haberle agregado ':' a Bocas de Iluminacion
      expect(newText).toContain('  - 10 u Bocas de Iluminacion:');
      // Debe haber quitado el guión y sangrado materiales: a 6 espacios
      expect(newText).toContain('      materiales:\n        - ');
    });

    it('corrige la línea cuando el usuario escribe sólo materiales sin guión ni dos puntos', () => {
      const textBefore = `Instalación Eléctrica:\n  - Tablero Principal\nmateriales`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toContain('  - Tablero Principal:');
      expect(newText).toContain('      materiales:\n        - ');
    });

    it('alinea mano_obra: con materiales: al presionar Enter', () => {
      const textBefore = `Instalación Eléctrica:\n  - 10 u Bocas de Iluminacion:\n      materiales:\n        - 10 m Cable 2.5 mm\n        - mano_obra:`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toContain('      mano_obra:\n        - ');
    });

    it('cancela la viñeta y desindenta al presionar Enter en renglón de lista vacío', () => {
      const textBefore = `Instalación Eléctrica:\n  - 10 u Bocas:\n      materiales:\n        - 10 m Cable\n        - `;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      // Debe haber desindentado de 8 espacios a 6 espacios (alineado con materiales)
      expect(newText).toBe(`Instalación Eléctrica:\n  - 10 u Bocas:\n      materiales:\n        - 10 m Cable\n      `);
    });

    it('continúa la lista automáticamente al presionar Enter en ítem con contenido', () => {
      const textBefore = `Instalación Eléctrica:\n  - 10 u Bocas`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`Instalación Eléctrica:\n  - 10 u Bocas\n  - `);
    });

    it('agrega viñeta de lista al presionar Enter después de un encabezado con dos puntos', () => {
      const textBefore = `Tableros:`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`Tableros:\n  - `);
    });
  });

  describe('scoreSearchMatch (Búsqueda refinada multi-término y ranking)', () => {
    it('prioriza "Cable Unipolar" sobre "Bandeja Portacables" al buscar "cable"', () => {
      const scoreCable = scoreSearchMatch({
        query: 'cable',
        title: 'Cable Unipolar 2.5 mm² IRAM Normalizado',
        category: 'Conductores y Cables'
      });

      const scoreBandeja = scoreSearchMatch({
        query: 'cable',
        title: 'Bandeja Portacables Perforada 100x50 mm',
        category: 'Canalizaciones'
      });

      expect(scoreCable).toBeGreaterThan(0);
      expect(scoreBandeja).toBeGreaterThan(0);
      // El cable debe superar ampliamente a la bandeja portacables
      expect(scoreCable).toBeGreaterThan(scoreBandeja);
    });

    it('permite refinar la búsqueda fuera de orden ("iram cable" encuentra cables IRAM y descarta bandejas)', () => {
      const scoreCable = scoreSearchMatch({
        query: 'iram cable',
        title: 'Cable Unipolar 2.5 mm² IRAM Normalizado',
        category: 'Conductores y Cables'
      });

      const scoreBandeja = scoreSearchMatch({
        query: 'iram cable',
        title: 'Bandeja Portacables Perforada 100x50 mm',
        category: 'Canalizaciones'
      });

      // El cable coincide con ambos términos ("iram" y "cable")
      expect(scoreCable).toBeGreaterThan(0);
      // La bandeja NO contiene "iram", por lo que debe ser descartada completamente (-1)
      expect(scoreBandeja).toBe(-1);
    });

    it('tolera comas o puntos decimales y superíndices ("cable 2.5" vs "2,5 mm²")', () => {
      const scorePunto = scoreSearchMatch({
        query: 'cable 2.5 iram',
        title: 'Cable Unipolar 2,5 mm² IRAM',
        category: 'Cables'
      });

      const scoreComa = scoreSearchMatch({
        query: 'cable 2,5 iram',
        title: 'Cable Unipolar 2.5 mm2 IRAM',
        category: 'Cables'
      });

      expect(scorePunto).toBeGreaterThan(0);
      expect(scoreComa).toBeGreaterThan(0);
    });

    it('soporta búsquedas de 3 o más términos en cualquier orden', () => {
      const score1 = scoreSearchMatch({
        query: 'cable unipolar 2.5 iram',
        title: 'Cable Unipolar 2.5 mm² IRAM Normalizado',
        category: 'Cables'
      });

      const score2 = scoreSearchMatch({
        query: 'iram 2.5 cable unipolar',
        title: 'Cable Unipolar 2.5 mm² IRAM Normalizado',
        category: 'Cables'
      });

      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
      // La búsqueda en orden exacto recibe un bonus de orden
      expect(score1).toBeGreaterThan(score2);
    });

    it('devuelve -1 si falta al menos uno de los términos requeridos', () => {
      const score = scoreSearchMatch({
        query: 'cable sintenax termica',
        title: 'Cable Sintenax 4x4 mm',
        category: 'Cables'
      });

      expect(score).toBe(-1);
    });

    it('coincide y clasifica búsquedas numéricas y con decimales como "cabl 1.5" y "cable unipolar 1.5"', () => {
      const title = 'Cable Unipolar 1.5 mm² Marrón (Fase) IRAM 247-3';
      expect(scoreSearchMatch({ query: 'cabl 1.5', title })).toBeGreaterThan(0);
      expect(scoreSearchMatch({ query: 'cable unipolar 1.5', title })).toBeGreaterThan(0);
      expect(scoreSearchMatch({ query: 'cable unipolar 1.', title })).toBeGreaterThan(0);
      expect(scoreSearchMatch({ query: '1.5 cable', title })).toBeGreaterThan(0);
      expect(scoreSearchMatch({ query: 'cable 1,5', title })).toBeGreaterThan(0);
    });
  });

  describe('detectSuggestTrigger (Detección inteligente de consultas e IntelliSense)', () => {
    it('detecta consultas continuas con decimales y números como "cable unipolar 1.5" o "cabl 1.5"', () => {
      const res1 = detectSuggestTrigger('        - cable unipolar 1.5');
      expect(res1).not.toBeNull();
      expect(res1?.query).toBe('cable unipolar 1.5');
      expect(res1?.isExplicit).toBe(false);

      const res2 = detectSuggestTrigger('        - cabl 1.5');
      expect(res2).not.toBeNull();
      expect(res2?.query).toBe('cabl 1.5');

      // Mientras el usuario va tipeando el punto "1." no debe cancelarse ni cerrarse
      const res3 = detectSuggestTrigger('        - cable unipolar 1.');
      expect(res3).not.toBeNull();
      expect(res3?.query).toBe('cable unipolar 1.');
    });

    it('detecta consultas tras cantidad y unidad ("- 25 m cabl 1.5")', () => {
      const res = detectSuggestTrigger('        - 25 m cabl 1.5');
      expect(res).not.toBeNull();
      expect(res?.query).toBe('cabl 1.5');
    });

    it('detecta consultas tras cantidad sin unidad ("- 25 cabl 1.5")', () => {
      const res = detectSuggestTrigger('        - 25 cabl 1.5');
      expect(res).not.toBeNull();
      expect(res?.query).toBe('cabl 1.5');
    });

    it('detecta insumos con caracteres especiales como comillas y barras ("- 10 u caño corrugado 3/4\\"")', () => {
      const res = detectSuggestTrigger('        - 10 u caño corrugado 3/4"');
      expect(res).not.toBeNull();
      expect(res?.query).toBe('caño corrugado 3/4"');
    });

    it('detecta especificaciones numéricas como "3x2.5" o "2x16 termica"', () => {
      const res1 = detectSuggestTrigger('        - 3x2.5');
      expect(res1).not.toBeNull();
      expect(res1?.query).toBe('3x2.5');

      const res2 = detectSuggestTrigger('        - 2x16 termica');
      expect(res2).not.toBeNull();
      expect(res2?.query).toBe('2x16 termica');
    });

    it('no activa autocompletado si el usuario está tipeando un número aislado o cantidad', () => {
      expect(detectSuggestTrigger('        - 10')).toBeNull();
      expect(detectSuggestTrigger('        - 10 ')).toBeNull();
      expect(detectSuggestTrigger('        - 1.5')).toBeNull();
      expect(detectSuggestTrigger('        - 1.5 ')).toBeNull();
    });

    it('no activa autocompletado para palabras clave YAML de estructura', () => {
      expect(detectSuggestTrigger('        - materiales:')).toBeNull();
      expect(detectSuggestTrigger('        - mano_obra:')).toBeNull();
      expect(detectSuggestTrigger('        - mo:')).toBeNull();
    });

    it('detecta comandos explícitos con "/" o "@" sin confundir fracciones de medidas ("3/4")', () => {
      const res1 = detectSuggestTrigger('/cable 1.5');
      expect(res1).toEqual({
        triggerChar: '/',
        query: 'cable 1.5',
        queryIndexInLine: 0,
        isExplicit: true
      });

      const res2 = detectSuggestTrigger('        @oficial');
      expect(res2).toEqual({
        triggerChar: '@',
        query: 'oficial',
        queryIndexInLine: 8,
        isExplicit: true
      });

      // Fracción "3/4" no debe interpretarse como comando slash
      const res3 = detectSuggestTrigger('        - 1 u Caño 3/4');
      expect(res3?.isExplicit).toBe(false);
      expect(res3?.query).toBe('Caño 3/4');
    });
  });

  describe('Soporte de Producto/Marca y Propiedades Estructuradas de Materiales', () => {
    it('extrae marca entre corchetes "[Prysmian]" en línea rápida con cantidad y precio', () => {
      const dsl = `
Instalación Eléctrica:
  - Tablero Principal:
      materiales:
        - 50 m Cable Unipolar 1.5 mm² [Prysmian]: $ 1.250
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const compositeItem = res.items[0];
      expect(compositeItem.insumosSnapshot?.length).toBe(1);
      const mat = compositeItem.insumosSnapshot![0];
      expect(mat.nombre).toBe('Cable Unipolar 1.5 mm²');
      expect(mat.marca).toBe('Prysmian');
      expect(mat.cantidadTotal).toBe(50);
      expect(mat.unidad).toBe('m');
      expect(mat.precioUnitarioCongelado).toBe(1250);
      expect(mat.subtotalInsumo).toBe(62500);
    });

    it('parsea propiedades anidadas de material en YAML (cantidad, unidad, producto, precio)', () => {
      const dsl = `
Instalación Eléctrica:
  - Tablero Seccional:
      materiales:
        - Gabinete DIN 24 módulos:
            cantidad: 2 u
            producto: Roker Práctico
            precio: 28500
        - Disyuntor Bipolar 25A:
            cantidad: 1
            unidad: u
            marca: Schneider Acti9
            precio: 35000
        - nombre: Térmica 2x16
          cantidad: 4 u
          marca: Sica
          precio: 9500
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const item = res.items[0];
      expect(item.insumosSnapshot?.length).toBe(3);

      const mat1 = item.insumosSnapshot![0];
      expect(mat1.nombre).toBe('Gabinete DIN 24 módulos');
      expect(mat1.cantidadTotal).toBe(2);
      expect(mat1.unidad).toBe('u');
      expect(mat1.marca).toBe('Roker Práctico');
      expect(mat1.precioUnitarioCongelado).toBe(28500);
      expect(mat1.subtotalInsumo).toBe(57000);

      const mat2 = item.insumosSnapshot![1];
      expect(mat2.nombre).toBe('Disyuntor Bipolar 25A');
      expect(mat2.cantidadTotal).toBe(1);
      expect(mat2.marca).toBe('Schneider Acti9');
      expect(mat2.precioUnitarioCongelado).toBe(35000);

      const mat3 = item.insumosSnapshot![2];
      expect(mat3.nombre).toBe('Térmica 2x16');
      expect(mat3.cantidadTotal).toBe(4);
      expect(mat3.marca).toBe('Sica');
      expect(mat3.precioUnitarioCongelado).toBe(9500);
      expect(mat3.subtotalInsumo).toBe(38000);
    });

    it('serializa insumos incluyendo marca entre corchetes si está presente', () => {
      const item: ItemPresupuesto = {
        id: 'it-test',
        descripcion: 'Tablero Seccional',
        cantidad: 1,
        unidad: 'u',
        costoUnitario: 50000,
        costoDirectoTotal: 50000,
        costoInsumos: 36000,
        costoManoObra: 0,
        precioVentaUnitario: 65000,
        precioVentaTotal: 65000,
        esAdHoc: true,
        insumosSnapshot: [
          {
            insumoId: 'mat-1',
            nombre: 'Cable Unipolar 2.5 mm²',
            marca: 'Prysmian',
            cantidadTotal: 30,
            unidad: 'm',
            precioUnitarioCongelado: 1200,
            subtotalInsumo: 36000
          }
        ],
        manoObraSnapshot: []
      };

      const serialized = serializePresupuestoToDSL({
        clienteId: 'cli-1',
        tipoFactura: 'Factura A',
        validezDias: 15,
        margenPorcentaje: 35,
        clientes: mockClientes,
        capitulos: [{ id: 'cap-1', nombre: 'Tableros', orden: 1 }],
        items: [{ ...item, capituloId: 'cap-1' }]
      });

      expect(serialized).toContain('- 30 m Cable Unipolar 2.5 mm² [Prysmian] : $ 1.200');
    });
  });

  describe('Ingreso y Edición Fluida de Cantidades de Materiales (Propiedades y Autocompletado)', () => {
    it('preprocessYamlText añade ":" al material si el usuario escribió propiedades indentadas debajo sin dos puntos', () => {
      const raw = `
Instalación:
  - Tablero:
      materiales:
        - Cable Unipolar 1.5 mm²
            cantidad: 50 m
            producto: Prysmian
`;
      const processed = preprocessYamlText(raw);
      expect(processed).toContain('- Cable Unipolar 1.5 mm²:');
      expect(processed).toContain('cantidad: 50 m');
    });

    it('preprocessYamlText no altera líneas que ya tienen dos puntos', () => {
      const raw = `
Instalación:
  - Tablero:
      materiales:
        - nombre: Cable Unipolar 1.5 mm²
          cantidad: 50 m
        - Disyuntor Bipolar:
            cantidad: 1 u
`;
      const processed = preprocessYamlText(raw);
      expect(processed).toBe(raw);
    });

    it('parsea correctamente material cuando la cantidad está anidada omitiendo dos puntos en la cabecera', () => {
      const dsl = `
Instalación Eléctrica:
  - Circuito 1:
      materiales:
        - Cable Unipolar 1.5 mm²
            cantidad: 75 m
            precio: 1200
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const mat = res.items[0].insumosSnapshot![0];
      expect(mat.nombre).toBe('Cable Unipolar 1.5 mm²');
      expect(mat.cantidadTotal).toBe(75);
      expect(mat.unidad).toBe('m');
      expect(mat.precioUnitarioCongelado).toBe(1200);
      expect(mat.subtotalInsumo).toBe(90000);
    });

    it('parsea correctamente material cuando las propiedades tienen guión de lista (- cantidad: 50 m)', () => {
      const dsl = `
Instalación Eléctrica:
  - Circuito 1:
      materiales:
        - Cable Unipolar 1.5 mm²:
            - cantidad: 50 m
            - precio: 1250
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const mat = res.items[0].insumosSnapshot![0];
      expect(mat.nombre).toBe('Cable Unipolar 1.5 mm²');
      expect(mat.cantidadTotal).toBe(50);
      expect(mat.precioUnitarioCongelado).toBe(1250);
    });

    it('permite sobreescribir la cantidad por defecto con la propiedad "cantidad:" si la cabecera tenía "1 u"', () => {
      const dsl = `
Instalación Eléctrica:
  - Circuito 1:
      materiales:
        - 1 u Cable Unipolar 1.5 mm²:
            cantidad: 80 m
            precio: 1300
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const mat = res.items[0].insumosSnapshot![0];
      expect(mat.nombre).toBe('Cable Unipolar 1.5 mm²');
      expect(mat.cantidadTotal).toBe(80);
      expect(mat.unidad).toBe('m');
      expect(mat.precioUnitarioCongelado).toBe(1300);
    });

    it('handleYamlSmartEnter: al presionar Enter en "- Material:" sin cantidad, auto-genera "cantidad: "', () => {
      const textBefore = `      materiales:\n        - Cable Unipolar 1.5 mm²:`;
      const textAfter = '';
      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`      materiales:\n        - Cable Unipolar 1.5 mm²:\n            cantidad: `);
    });

    it('handleYamlSmartEnter: al presionar Enter en "- 1 u Material:", sangra 4 espacios sin viñeta para propiedades', () => {
      const textBefore = `      materiales:\n        - 1 u Disyuntor 25A:`;
      const textAfter = '';
      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`      materiales:\n        - 1 u Disyuntor 25A:\n            `);
    });

    it('handleYamlSmartEnter: al presionar Enter en renglón vacío tras propiedades, desindenta para el siguiente material', () => {
      const textBefore = `      materiales:\n        - Cable 1.5 mm²:\n            cantidad: 50 m\n            `;
      const textAfter = '';
      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`      materiales:\n        - Cable 1.5 mm²:\n            cantidad: 50 m\n        - `);
    });

    it('formatSlashCommandReplacement devuelve selectionRange sobre el "1" por defecto cuando el usuario no tipeó cantidad previa', () => {
      const { replacementLine, selectionRange } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - cab',
        snippet: '- 1 u Cable Unipolar 2.5 mm\n'
      });

      expect(replacementLine).toBe('        - 1 u Cable Unipolar 2.5 mm\n');
      expect(selectionRange).toBeDefined();
      // En "        - 1 u ...", el "1" está en los índices 10 a 11
      expect(replacementLine.slice(selectionRange!.start, selectionRange!.end)).toBe('1');
    });

    it('formatSlashCommandReplacement no define selectionRange si el usuario ya tipeó cantidad explícita previa', () => {
      const { replacementLine, selectionRange } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - 50 m cab',
        snippet: '- 1 u Cable Unipolar 2.5 mm\n'
      });

      expect(replacementLine).toBe('        - 50 m Cable Unipolar 2.5 mm\n');
      expect(selectionRange).toBeUndefined();
    });

    it('detectSuggestTrigger detecta palabras escritas en líneas indentadas de propiedades (ej: "    can")', () => {
      const trigger = detectSuggestTrigger('            can');
      expect(trigger).not.toBeNull();
      expect(trigger?.query).toBe('can');
      expect(trigger?.queryIndexInLine).toBe(12);
    });

    it('detectSuggestTrigger se cierra cuando la propiedad ya tiene dos puntos (ej: "    cantidad: 50")', () => {
      const trigger = detectSuggestTrigger('            cantidad: 50');
      expect(trigger).toBeNull();
    });

    it('formatSlashCommandReplacement indenta snippets multilínea y posiciona el cursor en "cantidad: " vacío', () => {
      const blockSnippet = `- Cable Unipolar 2.5 mm:\n    cantidad: \n    producto: Prysmian\n    precio: 1250\n`;
      const { replacementLine, selectionRange, newCursorOffset } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - cab',
        snippet: blockSnippet
      });

      expect(replacementLine).toBe(
        '        - Cable Unipolar 2.5 mm:\n            cantidad: \n            producto: Prysmian\n            precio: 1250\n'
      );
      expect(selectionRange).toBeUndefined();
      // El cursor debe estar justo después de "cantidad: "
      const cantIndex = replacementLine.indexOf('cantidad: ');
      expect(newCursorOffset).toBe(cantIndex + 'cantidad: '.length);
    });

    it('formatSlashCommandReplacement inyecta la cantidad previa del usuario en un bloque multilínea', () => {
      const blockSnippet = `- Cable Unipolar 2.5 mm:\n    cantidad: \n    producto: Prysmian\n    precio: 1250\n`;
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - 75 m cab',
        snippet: blockSnippet
      });

      expect(replacementLine).toContain('cantidad: 75 m');
    });

    it('parseDSLToPresupuesto evalúa tareas tipo paramétricas y calcula dinámicamente según parametros en YAML', () => {
      const mockTareaParametrica: TareaTipo = {
        id: 'tt-param-prueba',
        nombre: 'Instalación de Bocas y Circuitos',
        categoria: 'Bocas',
        unidad: 'u',
        parametros: [
          {
            id: 'bocas',
            nombre: 'Cantidad de Bocas',
            tipo: 'numero',
            valorDefault: 5
          },
          {
            id: 'unifilar',
            nombre: 'Plano Unifilar',
            tipo: 'boolean',
            valorDefault: 0,
            condicion: 'bocas > 10'
          }
        ],
        variables: [
          {
            id: 'metros_cable',
            nombre: 'Metros de cable',
            formula: 'bocas * 12',
            unidad: 'm'
          }
        ],
        insumos: [
          {
            nombreSlot: 'Cable 2.5 mm',
            materialId: 'mat-cabl-25',
            cantidad: 60,
            formula: 'metros_cable'
          }
        ],
        manoObra: [
          {
            categoriaId: 'mo-oficial',
            horas: 5,
            formula: 'bocas * 0.8'
          }
        ]
      };

      const insMap = new Map();
      insMap.set('mat-cabl-25', {
        id: 'mat-cabl-25',
        nombre: 'Cable 2.5 mm',
        precioActual: 100,
        unidad: 'm'
      });

      const moMap = new Map();
      moMap.set('mo-oficial', {
        id: 'mo-oficial',
        nombre: 'Oficial Electricista',
        costoHora: 1000
      });

      const yaml = `Capítulo Prueba:
  - Instalación de Bocas y Circuitos:
      cantidad: 1 u
      parametros:
        bocas: 20
`;

      const result = parseDSLToPresupuesto(yaml, {
        clientes: [],
        tareasTipo: [mockTareaParametrica],
        insumosMap: insMap,
        manoObraMap: moMap
      });

      expect(result.items.length).toBe(1);
      const item = result.items[0];
      expect(item.tareaTipoId).toBe('tt-param-prueba');
      expect(item.valoresParametros?.bocas).toBe(20);
      expect(item.valoresVariables?.metros_cable).toBe(240); // 20 * 12
      // Metros de cable = 240m * $100 = $24.000
      expect(item.costoInsumos).toBe(24000);
      // Horas oficial = 20 * 0.8 = 16hs * $1000 = $16.000
      expect(item.costoManoObra).toBe(16000);
      expect(item.costoDirectoTotal).toBe(40000);
    });

    it('preprocessYamlText y parseDSLToPresupuesto procesan partidas huérfanas sin capítulo explícito sin error de sintaxis', () => {
      const userYaml = `# ============================================================
# COTIZACIÓN INTELIGENTE - MODO EXPERTO (YAML)
# ============================================================

cliente: Federico
obra: 
factura: Factura C
validez: 15 dias
margen: 35%
riesgo: bajo
dolar: USD Blue  



  - 1 u Reparación de tablero:
      materiales:
        - Tablero Modular DIN 24 Módulos Superficie Chapa Metálica Puerta Ciega IP40:
            cantidad: 1
            marca: Gabexel
`;

      const preprocessed = preprocessYamlText(userYaml);
      expect(preprocessed).toContain('Trabajos:');

      const result = parseDSLToPresupuesto(userYaml, {
        clientes: [],
        tareasTipo: [],
        insumosMap: new Map(),
        manoObraMap: new Map()
      });

      // No debe contener errores de sintaxis
      const errorDiag = result.diagnostics.filter((d) => d.type === 'error');
      expect(errorDiag).toHaveLength(0);

      // Debe haber creado el capítulo Trabajos por defecto
      expect(result.capitulos.length).toBeGreaterThanOrEqual(1);
      expect(result.capitulos[0].nombre).toBe('Trabajos');

      // Debe haber parseado la partida y su material
      expect(result.items.length).toBe(1);
      expect(result.items[0].descripcion).toBe('Reparación de tablero');
      expect(result.items[0].insumosSnapshot.length).toBe(1);
      expect(result.items[0].insumosSnapshot[0].nombre).toContain('Tablero Modular DIN 24');
      expect(result.items[0].insumosSnapshot[0].marca).toBe('Gabexel');
    });

    it('detectCursorContext infiere contexto "tareas" al tipear en una partida aunque no haya capítulo explícito', () => {
      const textBefore = `cliente: Federico
dolar: USD Blue

  - 1 u Rep`;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('tareas');
    });

    it('detectCursorContext infiere contexto "tareas" al escribir propiedades indentadas bajo una partida', () => {
      const textBefore = `  - 1 u Reparación de tablero:
      mat`;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('tareas');
    });

    it('detectCursorContext infiere contexto "materiales" únicamente cuando el ancestro es "materiales:"', () => {
      const textBefore = `  - 1 u Reparación de tablero:
      materiales:
        - Tab`;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('materiales');
    });

    it('detectCursorContext retiene contexto "materiales" en el siguiente ítem tras un material existente con propiedades y dos puntos', () => {
      const textBefore = `Refacciones:
  - 1 u Reparación de tablero:
      materiales:
        - Tablero Modular DIN 36 Módulos:
            cantidad: 1
            marca: Gabexel
        - Cable Unipolar:
            cantidad: 10
            precio: 1510
        - `;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('materiales');
    });

    it('detectCursorContext retiene contexto "materiales" al escribir propiedades indentadas bajo un ítem', () => {
      const textBefore = `Refacciones:
  - 1 u Reparación de tablero:
      materiales:
        - Tablero Modular DIN 36 Módulos:
            `;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('materiales');
    });

    it('detectSuggestTrigger detecta disparadores de propiedades con un solo caracter (ej: "    c" o "    p")', () => {
      const triggerC = detectSuggestTrigger('            c');
      expect(triggerC).not.toBeNull();
      expect(triggerC?.query).toBe('c');

      const triggerP = detectSuggestTrigger('            p');
      expect(triggerP).not.toBeNull();
      expect(triggerP?.query).toBe('p');
    });

    it('formatSlashCommandReplacement formatea mano_obra: a exactamente 6 espacios sin importar la sangría del cursor', () => {
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '        - mo',
        snippet: 'mano_obra:\n  - ',
        contextType: 'materiales'
      });
      expect(replacementLine.startsWith('      mano_obra:')).toBe(true);
    });

    it('handleYamlSmartBackspace retrocede niveles jerárquicos automáticamente en líneas vacías y viñetas vacías', () => {
      // 1. Desde nivel 5 (12 espacios de propiedad vacía) retrocede a nivel 4 (8 espacios + viñeta)
      const res5 = handleYamlSmartBackspace({
        textBefore: '            ',
        textAfter: ''
      });
      expect(res5).not.toBeNull();
      expect(res5?.newText).toBe('        - ');

      // 2. Desde nivel 4 (viñeta vacía de material "        - ") retrocede a nivel 3 (6 espacios de sección)
      const res4 = handleYamlSmartBackspace({
        textBefore: '        - ',
        textAfter: ''
      });
      expect(res4).not.toBeNull();
      expect(res4?.newText).toBe('      ');

      // 3. Desde nivel 3 (6 espacios de sección vacía) retrocede a nivel 2 (2 espacios + viñeta de partida)
      const res3 = handleYamlSmartBackspace({
        textBefore: '      ',
        textAfter: ''
      });
      expect(res3).not.toBeNull();
      expect(res3?.newText).toBe('  - ');

      // 4. Desde nivel 2 (viñeta de partida vacía "  - ") retrocede a nivel 1 (raíz)
      const res2 = handleYamlSmartBackspace({
        textBefore: '  - ',
        textAfter: ''
      });
      expect(res2).not.toBeNull();
      expect(res2?.newText).toBe('');

      // 5. En texto con contenido (ej: "cantidad: 10"), retorna null para permitir borrado estándar de caracter
      const resText = handleYamlSmartBackspace({
        textBefore: '            cantidad: 10',
        textAfter: ''
      });
      expect(resText).toBeNull();
    });

    it('handleYamlSmartEnter escala hacia afuera en la jerarquía al presionar Enter en líneas y viñetas vacías', () => {
      // 1. Enter en línea vacía de propiedades (12 espacios) genera viñeta de siguiente ítem (8 espacios + "- ")
      const enterFromProp = handleYamlSmartEnter({
        textBefore: 'Refacciones:\n  - Partida:\n      materiales:\n        - Cable:\n            cantidad: 1\n            ',
        textAfter: ''
      });
      expect(enterFromProp.newText.endsWith('        - ')).toBe(true);

      // 2. Enter en viñeta vacía de ítem (8 espacios + "- ") desindenta a nivel sección (6 espacios)
      const enterFromItemBullet = handleYamlSmartEnter({
        textBefore: 'Refacciones:\n  - Partida:\n      materiales:\n        - ',
        textAfter: ''
      });
      expect(enterFromItemBullet.newText.endsWith('      ')).toBe(true);

      // 3. Enter en línea de sección vacía (6 espacios) desindenta a siguiente partida (2 espacios + "- ")
      const enterFromSection = handleYamlSmartEnter({
        textBefore: 'Refacciones:\n  - Partida:\n      ',
        textAfter: ''
      });
      expect(enterFromSection.newText.endsWith('  - ')).toBe(true);

      // 4. Enter en viñeta de partida vacía ("  - ") desindenta a nivel raíz ("")
      const enterFromPartidaBullet = handleYamlSmartEnter({
        textBefore: 'Refacciones:\n  - ',
        textAfter: ''
      });
      expect(enterFromPartidaBullet.newText.endsWith('Refacciones:\n')).toBe(true);
    });

    it('formatSlashCommandReplacement ajusta automáticamente la sangría base si se inserta en contexto de materiales', () => {
      const blockSnippet = `- Cable Unipolar 4 mm²:\n    cantidad: \n    precio: 1510\n`;
      // Usuario estaba en 6 espacios (mismo nivel que materiales:), no en 8
      const { replacementLine } = formatSlashCommandReplacement({
        currentLineBeforeCursor: '      - cab',
        snippet: blockSnippet,
        contextType: 'materiales'
      });

      // El ítem debe haberse normalizado a 8 espacios y las propiedades a 12 espacios
      expect(replacementLine).toContain('        - Cable Unipolar 4 mm²:');
      expect(replacementLine).toContain('            cantidad: ');
      expect(replacementLine).toContain('            precio: 1510');
    });

    it('parseDSLToPresupuesto parsea sin errores la cotización con despiece de prueba del usuario (Refacciones)', () => {
      const userYaml = `Refacciones:
  - 1 u Reparación de tablero:
      materiales:
        - Tablero Modular DIN 36 Módulos Embutir Plástico Puerta Fumé IP40:
            cantidad: 1
            marca: Gabexel
      - Cable Unipolar 4 mm² Marrón (Fase) IRAM 247-3:
          cantidad: 10
          precio: 1510 

      mano_obra:
        - 4h Oficial Electricista

        - 4 h Ayudante Electricista
`;

      const result = parseDSLToPresupuesto(userYaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      // No debe contener errores de sintaxis YAML
      const syntaxErrors = result.diagnostics.filter((d) => d.type === 'error');
      expect(syntaxErrors).toHaveLength(0);

      // Debe haber creado el capítulo Refacciones
      expect(result.capitulos).toHaveLength(1);
      expect(result.capitulos[0].nombre).toBe('Refacciones');

      // Debe haber creado la partida Reparación de tablero
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.descripcion).toBe('Reparación de tablero');
      expect(item.cantidad).toBe(1);

      // Debe haber registrado los 2 materiales en el desglose
      expect(item.insumosSnapshot).toHaveLength(2);
      expect(item.insumosSnapshot[0].nombre).toContain('Tablero Modular DIN 36');
      expect(item.insumosSnapshot[0].cantidadTotal).toBe(1);
      expect(item.insumosSnapshot[0].marca).toBe('Gabexel');

      expect(item.insumosSnapshot[1].nombre).toContain('Cable Unipolar 4 mm²');
      expect(item.insumosSnapshot[1].cantidadTotal).toBe(10);
      expect(item.insumosSnapshot[1].precioUnitarioCongelado).toBe(1510);

      // Debe haber registrado las 2 líneas de mano de obra (4h Oficial y 4 h Ayudante)
      expect(item.manoObraSnapshot).toHaveLength(2);
      expect(item.manoObraSnapshot[0].horasTotales).toBe(4);
      expect(item.manoObraSnapshot[0].nombreCategoria).toBe('Oficial');
      expect(item.manoObraSnapshot[0].costoHoraCongelado).toBe(5000); // Vinculado con mockManoObraMap mo-oficial

      expect(item.manoObraSnapshot[1].horasTotales).toBe(4);
      expect(item.manoObraSnapshot[1].nombreCategoria).toBe('Ayudante');
      expect(item.manoObraSnapshot[1].costoHoraCongelado).toBe(3500); // Vinculado con mockManoObraMap mo-ayudante
    });
  });
});


