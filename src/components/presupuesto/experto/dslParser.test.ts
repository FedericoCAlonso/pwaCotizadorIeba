import { describe, it, expect } from 'vitest';
import {
  parseDSLToPresupuesto,
  serializePresupuestoToDSL,
  getDefaultPresupuestoYAMLTemplate,
  generateExampleDSL,
  getFieldStops,
  findNextFillableField,
  parseLocalizedNumber,
  normalizeString,
  normalizeGastoDestino,
  parseGastoValueString,
  parseGastoItem,
  detectCursorContext,
  detectSuggestTrigger,
  formatSlashCommandReplacement,
  handleYamlSmartEnter,
  handleYamlSmartBackspace,
  handleYamlSmartTab,
  normalizePastedYaml,
  validateYamlStructure,
  extractCalculosBlockFromDsl,
  scoreSearchMatch,
  preprocessYamlText
} from './dslParser';
import { Cliente, TareaTipo, Insumo, CategoriaManoDeObra, ItemPresupuesto, CapituloPresupuesto, CostoIndirecto } from '../../../core/types';
import { calcularTotalesPresupuesto } from '../../../core/calculations';

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

  it('getDefaultPresupuestoYAMLTemplate genera la plantilla inicial limpia sin datos de relleno', () => {
    const template = getDefaultPresupuestoYAMLTemplate({ clientes: mockClientes });
    expect(template).toContain('# ============================================================');
    expect(template).toContain('cliente: Estudio Arq. Gómez');
    expect(template).toContain('factura: Factura C');
    expect(template).toContain('Capítulo 1:');
    expect(template).toContain('- 1 u');
    // Debe ser limpio: NO tener tareas ni materiales de ejemplo precargados
    expect(template).not.toContain('Instalación Eléctrica:');
    expect(template).not.toContain('Tableros y Automatización:');
    expect(template).not.toContain('materiales:');
  });

  it('getDefaultPresupuestoYAMLTemplate se parsea sin errores de sintaxis', () => {
    const template = getDefaultPresupuestoYAMLTemplate({ clientes: mockClientes });
    const result = parseDSLToPresupuesto(template, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    const errors = result.diagnostics.filter((d) => d.type === 'error');
    expect(errors).toHaveLength(0);
    expect(result.tipoFactura).toBe('Factura C');
    expect(result.mostrarDolar).toBe(false);
  });

  it('generateExampleDSL genera el ejemplo enriquecido con materiales, mano de obra y variables', () => {
    const example = generateExampleDSL(mockClientes[0]);
    expect(example).toContain('cliente: Estudio Arq. Gómez');
    expect(example).toContain('calculos:');
    expect(example).toContain('Instalación Eléctrica:');
    expect(example).toContain('Tableros y Automatización:');
    expect(example).toContain('materiales:');
    expect(example).toContain('mano_obra:');
    expect(example).toContain('gastos:');

    const result = parseDSLToPresupuesto(example, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });
    const errors = result.diagnostics.filter((d) => d.type === 'error');
    expect(errors).toHaveLength(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.gastosConfig.length).toBe(2);
  });

  it('parsea directiva dolar sólo con texto (ej: dolar: USD Blue) activando dolar con tasa por defecto', () => {
    const yaml = `
cliente: Estudio Arq. Gómez
factura: Factura C
dolar: USD Blue
Instalación:
  - 1 u Tarea Simple: $ 1000
    `;
    const result = parseDSLToPresupuesto(yaml, {
      clientes: mockClientes,
      tareasTipo: mockTareas,
      insumosMap: mockInsumosMap,
      manoObraMap: mockManoObraMap
    });

    expect(result.mostrarDolar).toBe(true);
    expect(result.nombreDolar).toBe('USD Blue');
    expect(result.cotizacionDolar).toBe(1400);
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
      // Debe haber quitado el guión y sangrado materiales: a 4 espacios (nivel semántico 2)
      expect(newText).toContain('    materiales:\n      - ');
    });

    it('corrige la línea cuando el usuario escribe sólo materiales sin guión ni dos puntos', () => {
      const textBefore = `Instalación Eléctrica:\n  - Tablero Principal\nmateriales`;
      const textAfter = '';

      const { newText } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toContain('  - Tablero Principal:');
      expect(newText).toContain('    materiales:\n      - ');
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

    it('indenta 2 espacios sin viñeta "- " al presionar Enter en calculos: o variables:', () => {
      const textBefore = `calculos:`;
      const textAfter = '';

      const { newText, newCursorPos } = handleYamlSmartEnter({ textBefore, textAfter });

      expect(newText).toBe(`calculos:\n  `);
      expect(newCursorPos).toBe(`calculos:\n  `.length);

      // También si no le puso los dos puntos
      const enterWithoutColon = handleYamlSmartEnter({ textBefore: 'variables', textAfter: '' });
      expect(enterWithoutColon.newText).toBe(`variables:\n  `);
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

    it('detecta palabras clave raíz como "calc" o "calculos:" para abrir sugerencias de cálculo', () => {
      const res1 = detectSuggestTrigger('calc');
      expect(res1).not.toBeNull();
      expect(res1?.query).toBe('calc');
      expect(res1?.triggerChar).toBe('/');

      const res2 = detectSuggestTrigger('calculos:');
      expect(res2).not.toBeNull();
      expect(res2?.query).toBe('calc');
      expect(res2?.triggerChar).toBe('/');
    });

    it('detecta triggers contextuales en el bloque "gastos:" sin requerir comandos explícitos', () => {
      // Línea con guión y espacio vacío bajo gastos
      const res1 = detectSuggestTrigger('  - ', 'gastos');
      expect(res1).not.toBeNull();
      expect(res1?.query).toBe('');
      expect(res1?.isExplicit).toBe(false);

      // Línea con guión y texto parcial
      const res2 = detectSuggestTrigger('  - seguro', 'gastos');
      expect(res2).not.toBeNull();
      expect(res2?.query).toBe('seguro');
      expect(res2?.isExplicit).toBe(false);

      // Línea indentada vacía tras Enter en gastos
      const res3 = detectSuggestTrigger('  ', 'gastos');
      expect(res3).not.toBeNull();
      expect(res3?.query).toBe('');
      expect(res3?.isExplicit).toBe(false);

      // Línea con texto sin guión bajo gastos
      const res4 = detectSuggestTrigger('  flete', 'gastos');
      expect(res4).not.toBeNull();
      expect(res4?.query).toBe('flete');
      expect(res4?.isExplicit).toBe(false);
    });

    it('formatea reemplazo de gastos del catálogo seleccionando el número para edición rápida', () => {
      const formattedPct = formatSlashCommandReplacement({
        currentLineBeforeCursor: '  - seg',
        snippet: '- Seguro ART: 8% sobre mano_obra\n',
        contextType: 'gastos'
      });
      expect(formattedPct.replacementLine).toBe('  - Seguro ART: 8% sobre mano_obra\n');
      expect(formattedPct.selectionRange).toBeDefined();
      const selected = formattedPct.replacementLine.slice(
        formattedPct.selectionRange!.start,
        formattedPct.selectionRange!.end
      );
      expect(selected).toBe('8');

      const formattedFijo = formatSlashCommandReplacement({
        currentLineBeforeCursor: '  - flet',
        snippet: '- Flete: $ 25000\n',
        contextType: 'gastos'
      });
      expect(formattedFijo.replacementLine).toBe('  - Flete: $ 25000\n');
      expect(formattedFijo.selectionRange).toBeDefined();
      const selectedFijo = formattedFijo.replacementLine.slice(
        formattedFijo.selectionRange!.start,
        formattedFijo.selectionRange!.end
      );
      expect(selectedFijo).toBe('25000');
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

    it('detectCursorContext infiere contexto "item" al escribir propiedades o subsecciones indentadas bajo una partida', () => {
      const textBefore = `  - 1 u Reparación de tablero:
      mat`;

      const { contextType } = detectCursorContext(textBefore);
      expect(contextType).toBe('item');
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

    it('handleYamlSmartEnter desindenta correctamente al nivel del ítem al presionar Enter en una propiedad de material', () => {
      // Caso 1: Terminar de completar cantidad en bloque con propiedades hermanas debajo (producto y precio)
      const resWithSiblings = handleYamlSmartEnter({
        textBefore: '      materiales:\n        - Cable Unipolar 1.5 mm²:\n            cantidad: 25 m',
        textAfter: '\n            producto: Prysmian\n            precio: 1200\n        - Térmica:'
      });

      expect(resWithSiblings.newText).toContain('            cantidad: 25 m\n            producto: Prysmian\n            precio: 1200\n        - \n        - Térmica:');
      expect(resWithSiblings.newText.indexOf('        - \n')).toBeGreaterThan(0);

      // Caso 2: Terminar de completar cantidad en bloque sin más propiedades debajo
      const resWithoutSiblings = handleYamlSmartEnter({
        textBefore: '      materiales:\n        - Cable Unipolar 1.5 mm²:\n            cantidad: 25 m',
        textAfter: ''
      });

      expect(resWithoutSiblings.newText.endsWith('        - ')).toBe(true);

      // Caso 3: Terminar de completar cantidad cuando el cursor está en el número o antes de la unidad
      const resCursorInQty = handleYamlSmartEnter({
        textBefore: '      materiales:\n        - Cable Unipolar 1.5 mm²:\n            cantidad: 25',
        textAfter: ' m\n            producto: Prysmian\n            precio: 1200'
      });

      expect(resCursorInQty.newText).toContain('            cantidad: 25 m\n            producto: Prysmian\n            precio: 1200\n        - ');
    });

    it('handleYamlSmartEnter no divide la línea al completar cantidad en ítem de material inline', () => {
      const resInline = handleYamlSmartEnter({
        textBefore: '      materiales:\n        - 25',
        textAfter: ' m Cable Unipolar 1.5 mm²\n        - 2 u Térmica'
      });

      expect(resInline.newText).toBe('      materiales:\n        - 25 m Cable Unipolar 1.5 mm²\n        - \n        - 2 u Térmica');
      expect(resInline.newCursorPos).toBe('      materiales:\n        - 25 m Cable Unipolar 1.5 mm²\n        - '.length);
    });

    it('detectSuggestTrigger dispara sugerencias desde la primera letra tipeada tras una viñeta', () => {
      const trigger1 = detectSuggestTrigger('        - c');
      expect(trigger1).not.toBeNull();
      expect(trigger1?.query).toBe('c');

      const trigger2 = detectSuggestTrigger('        - 10 u c');
      expect(trigger2).not.toBeNull();
      expect(trigger2?.query).toBe('c');

      const trigger3 = detectSuggestTrigger('  - b');
      expect(trigger3).not.toBeNull();
      expect(trigger3?.query).toBe('b');
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

  describe('Gestión de Clientes y Directivas de Cabecera en Modo Experto', () => {
    it('parseDSLToPresupuesto vincula cliente por dígitos de CUIT/DNI', () => {
      const yaml = `
cliente: 30123456789
obra: Obra CUIT
`;
      const result = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(result.clienteId).toBe('cli-1');
      expect(result.clienteMatched?.id).toBe('cli-1');
      expect(result.clienteMatched?.razonSocial).toBe('Estudio Arq. Gómez');
      expect(result.clienteQuery).toBe('30123456789');
    });

    it('parseDSLToPresupuesto guarda clienteQuery incluso si el cliente no está registrado', () => {
      const yaml = `
cliente: Comitente Desconocido SRL
obra: Av. Libertador 5000
`;
      const result = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(result.clienteId).toBe('');
      expect(result.clienteMatched).toBeUndefined();
      expect(result.clienteQuery).toBe('Comitente Desconocido SRL');
      expect(result.diagnostics.some((d) => d.type === 'warning' && d.message.includes('Comitente Desconocido SRL'))).toBe(true);
    });

    it('detectSuggestTrigger reconoce directivas de cabecera raíz (cliente, factura, validez, margen, riesgo, dolar)', () => {
      const trigCli = detectSuggestTrigger('cliente: ');
      expect(trigCli?.directiveType).toBe('cliente');
      expect(trigCli?.query).toBe('');

      const trigCliSearch = detectSuggestTrigger('cliente: Fed');
      expect(trigCliSearch?.directiveType).toBe('cliente');
      expect(trigCliSearch?.query).toBe('Fed');

      const trigFac = detectSuggestTrigger('factura: ');
      expect(trigFac?.directiveType).toBe('factura');

      const trigVal = detectSuggestTrigger('validez: 15');
      expect(trigVal?.directiveType).toBe('validez');
      expect(trigVal?.query).toBe('15');

      const trigMar = detectSuggestTrigger('margen: 3');
      expect(trigMar?.directiveType).toBe('margen');
      expect(trigMar?.query).toBe('3');

      const trigRie = detectSuggestTrigger('riesgo: no');
      expect(trigRie?.directiveType).toBe('riesgo');
      expect(trigRie?.query).toBe('no');

      const trigDol = detectSuggestTrigger('dolar: ME');
      expect(trigDol?.directiveType).toBe('dolar');
      expect(trigDol?.query).toBe('ME');
    });

    it('detectSuggestTrigger ignora directivas si el usuario está escribiendo un comentario (#)', () => {
      const trigComment = detectSuggestTrigger('factura: Factura A # com');
      expect(trigComment).toBeNull();
    });

    it('formatSlashCommandReplacement formatea limpiamente directivas sin duplicar prefijos', () => {
      // Directiva cliente:
      const resCli = formatSlashCommandReplacement({
        currentLineBeforeCursor: 'cliente: Fed',
        snippet: 'cliente: Federico Gómez\n',
        directiveType: 'cliente'
      });
      expect(resCli.replacementLine).toBe('cliente: Federico Gómez\n');

      // Directiva factura:
      const resFac = formatSlashCommandReplacement({
        currentLineBeforeCursor: 'factura: ',
        snippet: 'factura: Factura B\n',
        directiveType: 'factura'
      });
      expect(resFac.replacementLine).toBe('factura: Factura B\n');

      // Directiva validez:
      const resVal = formatSlashCommandReplacement({
        currentLineBeforeCursor: 'validez: 1',
        snippet: 'validez: 30 dias\n',
        directiveType: 'validez'
      });
      expect(resVal.replacementLine).toBe('validez: 30 dias\n');

      // Reemplazo desde atajo @ en línea nueva
      const resAt = formatSlashCommandReplacement({
        currentLineBeforeCursor: '@Fed',
        snippet: 'cliente: Federico Gómez\n',
        directiveType: 'cliente'
      });
      expect(resAt.replacementLine).toBe('cliente: Federico Gómez\n');
    });
  });

  describe('Celdas de cálculo y variables (Motor reactivo)', () => {
    it('evalúa bloque calculos: en cascada y resuelve variables globales', () => {
      const yaml = `
calculos:
  superficie: 120
  bocas: =ceil(superficie / 6)
  cable_m: =bocas * 12

Instalacion:
  - =bocas u Boca de Iluminación
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.calculatedCells).toBeDefined();
      expect(res.calculatedCells?.length).toBe(3);
      expect(res.calculatedCells?.find((c) => c.name === 'superficie')?.evaluatedValue).toBe(120);
      expect(res.calculatedCells?.find((c) => c.name === 'bocas')?.evaluatedValue).toBe(20);
      expect(res.calculatedCells?.find((c) => c.name === 'cable_m')?.evaluatedValue).toBe(240);

      expect(res.items.length).toBe(1);
      expect(res.items[0].cantidad).toBe(20);
      expect(res.items[0].descripcion).toBe('Boca de Iluminación');
    });

    it('soporta fórmulas en línea con paréntesis =(expresion) u Nombre', () => {
      const yaml = `
calculos:
  sup: 60

Instalacion:
  - =(sup / 6) u Boca de Iluminación
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      expect(res.items[0].cantidad).toBe(10);
    });

    it('soporta cálculo local dentro de tareas y despiece APU paramétrico', () => {
      const yaml = `
calculos:
  modulos_totales: 36

Tableros:
  - Tablero Principal:
      cantidad: 1 u
      calculos:
        termicas: 8
      materiales:
        - =termicas u Disyuntor 2x40A:
            precio: 25000
      mano_obra:
        - 4 h Oficial
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const tabItem = res.items[0];
      expect(tabItem.descripcion).toBe('Tablero Principal');
      expect(tabItem.insumosSnapshot?.length).toBe(1);
      expect(tabItem.insumosSnapshot?.[0].cantidadTotal).toBe(8);
      expect(tabItem.insumosSnapshot?.[0].precioUnitarioCongelado).toBe(25000);
      expect(tabItem.insumosSnapshot?.[0].subtotalInsumo).toBe(200000);
    });

    it('omite ítems o insumos cuya cantidad evaluada sea <= 0 (condicionales)', () => {
      const yaml = `
calculos:
  incluir_tue: 0
  tue_qty: =incluir_tue ? 5 : 0

Instalacion:
  - 10 u Boca de Iluminación
  - =tue_qty u Tomacorriente Especial
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      // El ítem con tue_qty = 0 debe omitirse automáticamente
      expect(res.items.length).toBe(1);
      expect(res.items[0].descripcion).toBe('Boca de Iluminación');
    });

    it('detectSuggestTrigger detecta disparador = para sugerir variables', () => {
      const trig1 = detectSuggestTrigger('cantidad: =');
      expect(trig1).not.toBeNull();
      expect(trig1?.triggerChar).toBe('=');

      const trig2 = detectSuggestTrigger('  - =boc');
      expect(trig2).not.toBeNull();
      expect(trig2?.triggerChar).toBe('=');
      expect(trig2?.query).toBe('boc');
    });

    it('formatSlashCommandReplacement autocompleta variables con prefijo =', () => {
      const res = formatSlashCommandReplacement({
        currentLineBeforeCursor: '    cantidad: =boc',
        snippet: '=bocas'
      });
      expect(res.replacementLine).toBe('    cantidad: =bocas ');
    });
  });

  describe('Navegación inteligente por campos (Alt+Enter / getFieldStops / findNextFillableField)', () => {
    it('detecta correctamente los puntos de parada en una plantilla básica', () => {
      const yaml = `cliente: Estudio Arq. Gómez
obra: Thames 1850
factura: Factura C
validez: 15 dias

Capítulo 1:
  - 1 u `;

      const stops = getFieldStops(yaml);
      expect(stops.length).toBeGreaterThanOrEqual(6);

      // Primer campo debe ser el valor de cliente
      const clienteStop = stops.find((s) => s.label === 'cliente');
      expect(clienteStop).toBeDefined();
      expect(yaml.slice(clienteStop!.start, clienteStop!.end)).toBe('Estudio Arq. Gómez');

      // Obra
      const obraStop = stops.find((s) => s.label === 'obra');
      expect(obraStop).toBeDefined();
      expect(yaml.slice(obraStop!.start, obraStop!.end)).toBe('Thames 1850');

      // Capítulo
      const capStop = stops.find((s) => s.label === 'capitulo');
      expect(capStop).toBeDefined();
      expect(yaml.slice(capStop!.start, capStop!.end)).toBe('Capítulo 1');

      // Cantidad del ítem
      const qtyStop = stops.find((s) => s.label === 'cantidad');
      expect(qtyStop).toBeDefined();
      expect(yaml.slice(qtyStop!.start, qtyStop!.end)).toBe('1');

      // Nombre del ítem nuevo (vacío, al final de la línea)
      const newItemStop = stops.find((s) => s.label === 'nombre_item_nuevo');
      expect(newItemStop).toBeDefined();
      expect(newItemStop!.start).toBe(newItemStop!.end);
    });

    it('navega hacia adelante con findNextFillableField', () => {
      const yaml = `cliente: Estudio Arq. Gómez
obra: Thames 1850
Capítulo 1:
  - 1 u `;

      const stops = getFieldStops(yaml);
      expect(stops.length).toBeGreaterThanOrEqual(3);

      // Desde el inicio del documento (cursor = 0), debe ir al primer campo
      const first = findNextFillableField({ text: yaml, cursorPos: 0, direction: 'forward' });
      expect(first).not.toBeNull();
      expect(first?.start).toBe(stops[0].start);

      // Desde el fin del primer campo, debe saltar al segundo
      const second = findNextFillableField({ text: yaml, cursorPos: stops[0].end, direction: 'forward' });
      expect(second).not.toBeNull();
      expect(second?.start).toBe(stops[1].start);
    });

    it('hace wrap-around hacia el inicio al llegar al final', () => {
      const yaml = `cliente: Pérez
obra: Rivadavia 100`;

      const stops = getFieldStops(yaml);
      const lastStop = stops[stops.length - 1];

      // Desde después del último campo, debe dar la vuelta al primero
      const wrapped = findNextFillableField({ text: yaml, cursorPos: lastStop.end + 5, direction: 'forward' });
      expect(wrapped).not.toBeNull();
      expect(wrapped?.start).toBe(stops[0].start);
    });

    it('navega hacia atrás con direction: backward y wrap-around al final', () => {
      const yaml = `cliente: Pérez
obra: Rivadavia 100`;

      const stops = getFieldStops(yaml);
      const firstStop = stops[0];
      const lastStop = stops[stops.length - 1];

      // Hacia atrás desde el segundo campo, debe ir al primero
      const prev = findNextFillableField({ text: yaml, cursorPos: lastStop.start, direction: 'backward' });
      expect(prev).not.toBeNull();
      expect(prev?.start).toBe(firstStop.start);

      // Hacia atrás desde el primer campo, debe dar la vuelta al último
      const wrappedBack = findNextFillableField({ text: yaml, cursorPos: 0, direction: 'backward' });
      expect(wrappedBack).not.toBeNull();
      expect(wrappedBack?.start).toBe(lastStop.start);
    });

    it('extrae campos de ítems completos con precio y variables de cálculo', () => {
      const yaml = `calculos:
  superficie: 120
Instalación:
  - 10 u Boca de Iluminación: $ 12.500`;

      const stops = getFieldStops(yaml);
      const varStop = stops.find((s) => s.label === 'superficie');
      expect(varStop).toBeDefined();
      expect(yaml.slice(varStop!.start, varStop!.end)).toBe('120');

      const qtyStop = stops.find((s) => s.label === 'cantidad');
      expect(qtyStop).toBeDefined();
      expect(yaml.slice(qtyStop!.start, qtyStop!.end)).toBe('10');

      const nameStop = stops.find((s) => s.label === 'nombre_item');
      expect(nameStop).toBeDefined();
      expect(yaml.slice(nameStop!.start, nameStop!.end)).toBe('Boca de Iluminación');

      const priceStop = stops.find((s) => s.label === 'precio_item');
      expect(priceStop).toBeDefined();
      expect(yaml.slice(priceStop!.start, priceStop!.end)).toBe('12.500');
    });
  });

  describe('Persistencia de Cálculos, Variables y Fórmulas en el Modelo de Datos', () => {
    it('extrae y persiste calculosVariables, calculatedCells y formulaCantidad en parseDSLToPresupuesto', () => {
      const yaml = `calculos:
  bocas: 24
  precio_unit: 5000
  total_est: =bocas * precio_unit

Capitulo 1:
  - =bocas u Instalacion de Bocas: $ =precio_unit
  - Tablero Principal:
      cantidad: =bocas / 4
      materiales:
        - =bocas * 2 u Conectores: $ 250
      mano_obra:
        - Oficial Electricista:
            horas: =bocas * 0.5
            precio: 8500`;

      const parsed = parseDSLToPresupuesto(yaml, {
        clientes: [],
        tareasTipo: [],
        insumosMap: new Map(),
        manoObraMap: new Map()
      });

      // 1. calculosVariables
      expect(parsed.calculosVariables).toBeDefined();
      expect(parsed.calculosVariables?.bocas).toBe(24);
      expect(parsed.calculosVariables?.precio_unit).toBe(5000);
      expect(parsed.calculosVariables?.total_est).toBe('=bocas * precio_unit');

      // 2. calculatedCells
      expect(parsed.calculatedCells).toBeDefined();
      expect(parsed.calculatedCells!.length).toBeGreaterThanOrEqual(3);
      const totalCell = parsed.calculatedCells!.find(c => c.name === 'total_est');
      expect(totalCell?.evaluatedValue).toBe(120000);

      // 3. Items con formulaCantidad
      expect(parsed.items.length).toBe(2);
      const itemSimple = parsed.items.find(it => it.descripcion.includes('Instalacion de Bocas'));
      expect(itemSimple).toBeDefined();
      expect(itemSimple?.cantidad).toBe(24);
      expect(itemSimple?.formulaCantidad).toBe('=bocas');
      expect(itemSimple?.precioManual).toBe(5000);

      // 4. Item compuesto con formulaCantidad, materiales y mano de obra
      const itemCompuesto = parsed.items.find(it => it.descripcion === 'Tablero Principal');
      expect(itemCompuesto).toBeDefined();
      expect(itemCompuesto?.cantidad).toBe(6);
      expect(itemCompuesto?.formulaCantidad).toBe('=bocas / 4');

      const mat = itemCompuesto?.insumosSnapshot?.[0];
      expect(mat).toBeDefined();
      expect(mat?.formulaCantidad).toBe('=bocas * 2');

      const mo = itemCompuesto?.manoObraSnapshot?.[0];
      expect(mo).toBeDefined();
      expect(mo?.formulaHoras).toBe('=bocas * 0.5');
    });

    it('serializePresupuestoToDSL preserva dslText exactamente si está presente', () => {
      const customDsl = `# Presupuesto de prueba con comentarios
calculos:
  ambientes: 3 # dormitorios
  bocas: =ambientes * 8

Iluminación:
  - =bocas u Bocas de techo: $ 15.000`;

      const serialized = serializePresupuestoToDSL({
        items: [],
        capitulos: [],
        gastosConfig: [],
        dslText: customDsl
      });

      expect(serialized).toBe(customDsl);
    });

    it('serializePresupuestoToDSL serializa calculosVariables y formulas si dslText no está provisto', () => {
      const serialized = serializePresupuestoToDSL({
        items: [
          {
            id: 'it1',
            descripcion: 'Puntos y Tomas',
            cantidad: 20,
            formulaCantidad: '=bocas',
            unidad: 'u',
            precioManual: 10000
          } as any
        ],
        capitulos: [],
        gastosConfig: [],
        calculosVariables: {
          bocas: 20,
          coef: 1.15
        }
      });

      expect(serialized).toContain('calculos:');
      expect(serialized).toContain('bocas: 20');
      expect(serialized).toContain('coef: 1.15');
      expect(serialized).toContain('- =bocas u Puntos y Tomas: $ 10.000');
    });

    it('interpreta bloque "calculo:" (singular) y "cálculos:" correctamente', () => {
      const dsl = `cliente: Federico Gómez
obra: Casa Central

calculo:
  bocas: 24
  precio_boca: 5000
  total: = bocas * precio_boca

Instalación:
  - 1 u Tablero Principal: $ 150.000`;

      const parsed = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(parsed.calculatedCells).toBeDefined();
      expect(parsed.calculatedCells!.length).toBe(3);
      expect(parsed.calculatedCells!.find((c) => c.name === 'bocas')?.evaluatedValue).toBe(24);
      expect(parsed.calculatedCells!.find((c) => c.name === 'total')?.evaluatedValue).toBe(120000);
      expect(parsed.calculosVariables?.bocas).toBe(24);
      // "calculo" NO debe haber sido tratado como un capítulo
      expect(parsed.capitulos.some((c) => c.nombre.toLowerCase() === 'calculo')).toBe(false);
    });

    it('interpreta asignaciones "variable = expresion" sin dos puntos dentro de calculos:', () => {
      const dsl = `calculos:
  bocas = 24
  costo_hora = 12000
  horas = 10
  mano_obra = bocas * 2000`;

      const parsed = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(parsed.calculatedCells?.find((c) => c.name === 'bocas')?.evaluatedValue).toBe(24);
      expect(parsed.calculatedCells?.find((c) => c.name === 'costo_hora')?.evaluatedValue).toBe(12000);
      expect(parsed.calculatedCells?.find((c) => c.name === 'mano_obra')?.evaluatedValue).toBe(48000);
    });

    it('interpreta "cant: = bocas" y "calculo: = ..." dentro de una partida', () => {
      const dsl = `calculos:
  bocas: 20

Iluminación:
  - Bocas de Iluminacion:
      cant: = bocas
      precio: 8500
  - Armado de Tablero:
      calculo: = bocas / 5
      precio: 35000`;

      const parsed = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(parsed.items.length).toBe(2);
      expect(parsed.items[0].cantidad).toBe(20);
      expect(parsed.items[0].precioManual).toBe(8500);
      expect(parsed.items[1].cantidad).toBe(4);
      expect(parsed.items[1].precioManual).toBe(35000);
    });

    it('Problema 1: no crea un ítem falso ni vincula con el primer trabajo tipo cuando hay un renglón vacío o "- 1 u "', () => {
      const dsl = `
Capítulo 1:
  - 1 u 
  - 
  - "":
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(0);
    });

    it('Problema 2: permite escribir partidas libres sin que coincidan por subcadenas parciales con tareas del catálogo', () => {
      const dsl = `
Capítulo 1:
  - 1 u Arreglar cable bajo mesada: $ 15.000
  - 1 u Tablero para quincho con térmicas: $ 45.000
  - 1 u Colocación de artefacto en pared
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(3);

      // Primer ítem: contiene la palabra "cable", pero no debe convertirse en tarea de catálogo
      expect(res.items[0].tareaTipoId).toBeUndefined();
      expect(res.items[0].descripcion).toBe('Arreglar cable bajo mesada');
      expect(res.items[0].precioManual).toBe(15000);
      expect(res.items[0].costoUnitario).toBe(15000);

      // Segundo ítem: contiene "Tablero", pero no debe convertirse en tarea de catálogo
      expect(res.items[1].tareaTipoId).toBeUndefined();
      expect(res.items[1].descripcion).toBe('Tablero para quincho con térmicas');
      expect(res.items[1].precioManual).toBe(45000);

      // Tercer ítem: texto libre sin precio aún
      expect(res.items[2].tareaTipoId).toBeUndefined();
      expect(res.items[2].descripcion).toBe('Colocación de artefacto en pared');
    });

    it('vincula con trabajo tipo cuando el nombre coincide exactamente (ignorando mayúsculas y acentos)', () => {
      const dsl = `
Capítulo 1:
  - 10 u Boca de Iluminacion
  - 2 u disyuntor diferencial 2x40a
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(2);
      expect(res.items[0].tareaTipoId).toBe('tarea-boca');
      expect(res.items[0].descripcion).toBe('Boca de Iluminación');
      expect(res.items[1].tareaTipoId).toBe('tarea-disyuntor');
      expect(res.items[1].descripcion).toBe('Disyuntor Diferencial 2x40A');
    });

    it('parsea servicios y subcontratos dentro de una partida a medida', () => {
      const dsl = `
Montajes Especiales:
  - Tendido Aéreo con Grúa:
      materiales:
        - 50 m Cable Sintenax 4x6: $ 5000
      mano_obra:
        - 8 h Oficial
      servicios:
        - 1 u Hidroelevador con operador: $ 60000
        - Alquiler de andamios: $ 25000
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.items.length).toBe(1);
      const item = res.items[0];
      expect(item.descripcion).toBe('Tendido Aéreo con Grúa');
      expect(item.costoInsumos).toBe(250000); // 50 * 5000
      expect(item.costoManoObra).toBe(40000); // 8h * 5000
      expect(item.costoServicios).toBe(85000); // 60000 + 25000
      expect(item.costoDirectoTotal).toBe(375000); // 250000 + 40000 + 85000
    });

    it('soporta cálculos multilínea en YAML con > y |', () => {
      const dsl = `
calculos:
  superficie: 120
  computo_folded: >
    (superficie * 10)
    + 200
  computo_literal: |
    (superficie * 2)
    + 50
Capítulo 1:
  - =computo_folded u Cable unipolar 2.5
`;
      const res = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      const foldedCell = res.calculatedCells?.find((c) => c.name === 'computo_folded');
      expect(foldedCell).toBeDefined();
      expect(foldedCell?.evaluatedValue).toBe(1400); // (120 * 10) + 200

      const literalCell = res.calculatedCells?.find((c) => c.name === 'computo_literal');
      expect(literalCell).toBeDefined();
      expect(literalCell?.evaluatedValue).toBe(290); // (120 * 2) + 50
    });

    it('detecta correctamente los contextos del cursor: tareas, item, servicios, gastos y calculos', () => {
      // 1. Contexto bajo capítulo (tareas)
      const textChapter = `Capítulo 1:\n  - `;
      expect(detectCursorContext(textChapter).contextType).toBe('tareas');

      // 2. Contexto dentro de un ítem
      const textInsideItem = `Capítulo 1:\n  - Tablero Seccional:\n      `;
      expect(detectCursorContext(textInsideItem).contextType).toBe('item');

      // 3. Contexto dentro de servicios
      const textServices = `Capítulo 1:\n  - Tablero Seccional:\n      servicios:\n        - `;
      expect(detectCursorContext(textServices).contextType).toBe('servicios');

      // 4. Contexto dentro de gastos
      const textGastos = `gastos:\n  - `;
      expect(detectCursorContext(textGastos).contextType).toBe('gastos');

      // 5. Contexto dentro de calculos
      const textCalculos = `calculos:\n  `;
      expect(detectCursorContext(textCalculos).contextType).toBe('calculos');
    });

    it('normaliza destinos de gasto correctamente con normalizeGastoDestino', () => {
      expect(normalizeGastoDestino('mano_obra')).toBe('mano_obra');
      expect(normalizeGastoDestino('mano de obra')).toBe('mano_obra');
      expect(normalizeGastoDestino('mo')).toBe('mano_obra');
      expect(normalizeGastoDestino('labor')).toBe('mano_obra');

      expect(normalizeGastoDestino('materiales')).toBe('materiales');
      expect(normalizeGastoDestino('material')).toBe('materiales');
      expect(normalizeGastoDestino('insumos')).toBe('materiales');

      expect(normalizeGastoDestino('servicios')).toBe('servicios');
      expect(normalizeGastoDestino('subcontratos')).toBe('servicios');
      expect(normalizeGastoDestino('alquileres')).toBe('servicios');

      expect(normalizeGastoDestino('costo_directo')).toBe('costo_indirecto');
      expect(normalizeGastoDestino('costos directos')).toBe('costo_indirecto');
      expect(normalizeGastoDestino('costo directo')).toBe('costo_indirecto');
      expect(normalizeGastoDestino('directo')).toBe('costo_indirecto');
      expect(normalizeGastoDestino('total')).toBe('costo_indirecto');
      expect(normalizeGastoDestino('costo_indirecto')).toBe('costo_indirecto');
      expect(normalizeGastoDestino(undefined)).toBeUndefined();
    });

    it('parsea valores y expresiones de gasto con parseGastoValueString', () => {
      // Porcentual con destino
      const p1 = parseGastoValueString('8% sobre mano_obra');
      expect(p1.modalidad).toBe('porcentual');
      expect(p1.valor).toBe(8);
      expect(p1.destino).toBe('mano_obra');

      const p2 = parseGastoValueString('5% s/ materiales');
      expect(p2.modalidad).toBe('porcentual');
      expect(p2.valor).toBe(5);
      expect(p2.destino).toBe('materiales');

      const p3 = parseGastoValueString('10% sobre costo_directo');
      expect(p3.modalidad).toBe('porcentual');
      expect(p3.valor).toBe(10);
      expect(p3.destino).toBe('costo_indirecto');

      // Porcentual sin destino especificado -> default costo_indirecto
      const p4 = parseGastoValueString('12.5%');
      expect(p4.modalidad).toBe('porcentual');
      expect(p4.valor).toBe(12.5);
      expect(p4.destino).toBe('costo_indirecto');

      // Monto fijo en pesos
      const f1 = parseGastoValueString('$ 25.000');
      expect(f1.modalidad).toBe('monto_fijo');
      expect(f1.valor).toBe(25000);

      const f2 = parseGastoValueString(15000);
      expect(f2.modalidad).toBe('monto_fijo');
      expect(f2.valor).toBe(15000);

      // Expresión paramétrica
      const param = parseGastoValueString('=dias * 5000');
      expect(param.modalidad).toBe('parametrico');
      expect(param.formula).toBe('dias * 5000');
    });

    it('parsea gastos porcentuales y fijos en parseDSLToPresupuesto', () => {
      const yaml = `
gastos:
  - Seguro ART: 8% sobre mano_obra
  - Merma Insumos: 5% sobre materiales
  - Coordinación: 5% sobre servicios
  - Gastos Generales: 10% sobre costo_directo
  - Fondo Contingencia: 3%
  - Flete y Logística: $ 25.000
      `;

      const result = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(result.gastosConfig).toHaveLength(6);

      const art = result.gastosConfig.find((g) => g.nombre === 'Seguro ART');
      expect(art?.modalidad).toBe('porcentual');
      expect(art?.valor).toBe(8);
      expect(art?.destino).toBe('mano_obra');

      const merma = result.gastosConfig.find((g) => g.nombre === 'Merma Insumos');
      expect(merma?.modalidad).toBe('porcentual');
      expect(merma?.valor).toBe(5);
      expect(merma?.destino).toBe('materiales');

      const coord = result.gastosConfig.find((g) => g.nombre === 'Coordinación');
      expect(coord?.modalidad).toBe('porcentual');
      expect(coord?.valor).toBe(5);
      expect(coord?.destino).toBe('servicios');

      const generales = result.gastosConfig.find((g) => g.nombre === 'Gastos Generales');
      expect(generales?.modalidad).toBe('porcentual');
      expect(generales?.valor).toBe(10);
      expect(generales?.destino).toBe('costo_indirecto');

      const contingencia = result.gastosConfig.find((g) => g.nombre === 'Fondo Contingencia');
      expect(contingencia?.modalidad).toBe('porcentual');
      expect(contingencia?.valor).toBe(3);
      expect(contingencia?.destino).toBe('costo_indirecto');

      const flete = result.gastosConfig.find((g) => g.nombre === 'Flete y Logística');
      expect(flete?.modalidad).toBe('monto_fijo');
      expect(flete?.valor).toBe(25000);
    });

    it('parsea gastos estructurados en bloque YAML con porcentaje y aplica_a', () => {
      const yaml = `
gastos:
  - Seguro ART:
      porcentaje: 8%
      aplica_a: mano_obra
  - Flete de Materiales:
      monto: 35000
      `;

      const result = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(result.gastosConfig).toHaveLength(2);

      const art = result.gastosConfig.find((g) => g.nombre === 'Seguro ART');
      expect(art?.modalidad).toBe('porcentual');
      expect(art?.valor).toBe(8);
      expect(art?.destino).toBe('mano_obra');

      const flete = result.gastosConfig.find((g) => g.nombre === 'Flete de Materiales');
      expect(flete?.modalidad).toBe('monto_fijo');
      expect(flete?.valor).toBe(35000);
    });

    it('vincula gastos con el catálogo de CostosIndirectos y permite sobreescribir valores', () => {
      const catalogMock: CostoIndirecto[] = [
        {
          id: 'ci-art-catalog',
          nombre: 'Seguro de Accidentes Personales (ART)',
          modalidad: 'porcentual',
          valor: 8,
          destino: 'mano_obra'
        },
        {
          id: 'ci-flete-catalog',
          nombre: 'Flete y Movilidad Pesada',
          modalidad: 'monto_fijo',
          valor: 20000
        }
      ];

      // Caso 1: Se escribe sólo el nombre del gasto del catálogo -> hereda configuración
      const yaml1 = `
gastos:
  - Seguro de Accidentes Personales (ART)
  - Flete y Movilidad Pesada
      `;

      const res1 = parseDSLToPresupuesto(yaml1, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap,
        costosIndirectosCatalog: catalogMock
      });

      expect(res1.gastosConfig).toHaveLength(2);
      const art1 = res1.gastosConfig.find((g) => g.nombre === 'Seguro de Accidentes Personales (ART)');
      expect(art1?.costoIndirectoId).toBe('ci-art-catalog');
      expect(art1?.modalidad).toBe('porcentual');
      expect(art1?.valor).toBe(8);
      expect(art1?.destino).toBe('mano_obra');

      const flete1 = res1.gastosConfig.find((g) => g.nombre === 'Flete y Movilidad Pesada');
      expect(flete1?.costoIndirectoId).toBe('ci-flete-catalog');
      expect(flete1?.modalidad).toBe('monto_fijo');
      expect(flete1?.valor).toBe(20000);

      // Caso 2: Sobreescribe porcentaje manteniendo vínculo al catálogo
      const yaml2 = `
gastos:
  - Seguro de Accidentes Personales (ART): 12% sobre mano_obra
      `;
      const res2 = parseDSLToPresupuesto(yaml2, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap,
        costosIndirectosCatalog: catalogMock
      });

      const art2 = res2.gastosConfig[0];
      expect(art2.costoIndirectoId).toBe('ci-art-catalog');
      expect(art2.modalidad).toBe('porcentual');
      expect(art2.valor).toBe(12);
      expect(art2.destino).toBe('mano_obra');
    });

    it('serializa gastos con porcentajes, destinos y montos fijos en serializePresupuestoToDSL', () => {
      const dsl = serializePresupuestoToDSL({
        gastosConfig: [
          { id: 'g1', nombre: 'Seguro ART', modalidad: 'porcentual', valor: 8, destino: 'mano_obra', aplica: true },
          { id: 'g2', nombre: 'Merma Insumos', modalidad: 'porcentual', valor: 5, destino: 'materiales', aplica: true },
          { id: 'g3', nombre: 'Coordinación', modalidad: 'porcentual', valor: 5, destino: 'servicios', aplica: true },
          { id: 'g4', nombre: 'Gastos Generales', modalidad: 'porcentual', valor: 10, destino: 'costo_indirecto', aplica: true },
          { id: 'g5', nombre: 'Flete', modalidad: 'monto_fijo', valor: 25000, aplica: true }
        ]
      });

      expect(dsl).toContain('gastos:');
      expect(dsl).toContain('- Seguro ART: 8% sobre mano_obra');
      expect(dsl).toContain('- Merma Insumos: 5% sobre materiales');
      expect(dsl).toContain('- Coordinación: 5% sobre servicios');
      expect(dsl).toContain('- Gastos Generales: 10% sobre costo_directo');
      expect(dsl).toContain('- Flete: $ 25.000');

      // Roundtrip parsing
      const reparsed = parseDSLToPresupuesto(dsl, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(reparsed.gastosConfig).toHaveLength(5);
      expect(reparsed.gastosConfig[0].valor).toBe(8);
      expect(reparsed.gastosConfig[0].destino).toBe('mano_obra');
      expect(reparsed.gastosConfig[1].valor).toBe(5);
      expect(reparsed.gastosConfig[1].destino).toBe('materiales');
      expect(reparsed.gastosConfig[4].valor).toBe(25000);
      expect(reparsed.gastosConfig[4].modalidad).toBe('monto_fijo');
    });

    it('calcula correctamente los totales con gastos porcentuales sobre mano de obra y materiales', () => {
      const yaml = `
Instalación:
  - 1 u Tarea Con Desglose:
      materiales:
        - 10 u Cable:
            precio: 1000
      mano_obra:
        - 10 h Oficial:
            precio: 2000
gastos:
  - Seguro ART: 10% sobre mano_obra
  - Merma Materiales: 5% sobre materiales
      `;

      const parsed = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      const totales = calcularTotalesPresupuesto({
        items: parsed.items,
        gastosConfig: parsed.gastosConfig,
        margenPorcentaje: 0,
        tipoFactura: 'Presupuesto X (Sin Factura)',
        impuestosDetalle: []
      });

      // Materiales: 10 * 1000 = 10,000
      // Mano de obra: 10 * 2000 = 20,000
      // Gasto ART: 10% sobre 20,000 MO = 2,000
      // Gasto Merma: 5% sobre 10,000 Mat = 500
      // Total direct cost = 10,000 + 20,000 + 2,000 + 500 = 32,500
      expect(totales.subtotalInsumosBase).toBe(10000);
      expect(totales.subtotalInsumos).toBe(10500);
      expect(totales.subtotalManoObraBase).toBe(20000);
      expect(totales.subtotalManoObra).toBe(22000);
      expect(totales.gastosManoObraTotal).toBe(2000);
      expect(totales.gastosMaterialesTotal).toBe(500);
      expect(totales.subtotalCostosDirectos).toBe(32500);
    });

    it('selecciona automáticamente el valor numérico al insertar un gasto porcentual en formatSlashCommandReplacement', () => {
      const snippet = `- Seguro ART: 8% sobre mano_obra\n`;
      const result = formatSlashCommandReplacement({
        currentLineBeforeCursor: '  - seg',
        snippet,
        contextType: 'gastos'
      });

      expect(result.replacementLine).toBe('  - Seguro ART: 8% sobre mano_obra\n');
      expect(result.selectionRange).toBeDefined();

      const selected = result.replacementLine.substring(result.selectionRange!.start, result.selectionRange!.end);
      expect(selected).toBe('8');
    });

    it('selecciona automáticamente el monto fijo al insertar un gasto en pesos en formatSlashCommandReplacement', () => {
      const snippet = `- Flete y Logística: $ 25000\n`;
      const result = formatSlashCommandReplacement({
        currentLineBeforeCursor: '  - fle',
        snippet,
        contextType: 'gastos'
      });

      expect(result.replacementLine).toBe('  - Flete y Logística: $ 25000\n');
      expect(result.selectionRange).toBeDefined();

      const selected = result.replacementLine.substring(result.selectionRange!.start, result.selectionRange!.end);
      expect(selected).toBe('25000');
    });
  });

  describe('Eliminar silencios en el lint (Diagnósticos y Números de Línea)', () => {
    it('1a: detecta directivas raíz con typos y sugiere el nombre correcto', () => {
      const yaml = `
# Comentario inicial
clente: Estudio Arq. Gómez
margenn: 40
factura: Factura A

Capítulo 1:
  - 5 u Boca de Iluminación
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      const typoClientDiag = res.diagnostics.find((d) => d.message.includes("clente") && d.message.includes("cliente"));
      expect(typoClientDiag).toBeDefined();
      expect(typoClientDiag?.type).toBe('warning');
      expect(typoClientDiag?.line).toBe(3);

      const typoMargenDiag = res.diagnostics.find((d) => d.message.includes("margenn") && d.message.includes("margen"));
      expect(typoMargenDiag).toBeDefined();
      expect(typoMargenDiag?.type).toBe('warning');
      expect(typoMargenDiag?.line).toBe(4);
    });

    it('1b: emite error visible ante cantidades no numéricas y NO descarta el ítem', () => {
      const yaml = `
cliente: Juan Pérez
factura: Factura B

Instalación:
  - Boca de Iluminación:
      cantidad: muchas
      condicion: normal
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      // El ítem NO debe ser omitido
      expect(res.items.length).toBe(1);
      expect(res.items[0].descripcion).toBe('Boca de Iluminación');
      expect(res.items[0].cantidad).toBe(0);

      // Debe existir un error de diagnóstico visible en la línea correspondiente
      const errDiag = res.diagnostics.find((d) => d.type === 'error' && d.message.includes('muchas'));
      expect(errDiag).toBeDefined();
      expect(errDiag?.line).toBe(7);
    });

    it('1c: detecta propiedades de material mal escritas (cantiad: 10) y advierte el fallback', () => {
      const yaml = `
Capítulo 1:
  - Tablero Principal:
      materiales:
        - Cable 2.5mm:
            cantiad: 10
            precio: 500
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      const warn = res.diagnostics.find((d) => d.message.includes('cantiad') && d.message.includes('cantidad'));
      expect(warn).toBeDefined();
      expect(warn?.type).toBe('warning');
      expect(warn?.line).toBe(6);
    });

    it('1d: detecta valores fuera de dominio en factura, riesgo y validez reportando el fallback', () => {
      const yaml = `
cliente: Juan Pérez
factura: Factura Z
riesgo: extremo
validez: indefinida

Capítulo 1:
  - 1 u Boca de Iluminación
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      expect(res.tipoFactura).toBe('Factura A');
      const facturaWarn = res.diagnostics.find((d) => d.message.includes('Factura Z') && d.message.includes('Factura A'));
      expect(facturaWarn).toBeDefined();
      expect(facturaWarn?.line).toBe(3);

      expect(res.nivelMargenRiesgo).toBe('medio');
      const riesgoWarn = res.diagnostics.find((d) => d.message.includes('extremo') && d.message.includes('medio'));
      expect(riesgoWarn).toBeDefined();
      expect(riesgoWarn?.line).toBe(4);

      expect(res.validezDias).toBe(15);
      const validezWarn = res.diagnostics.find((d) => d.message.includes('indefinida') && d.message.includes('15'));
      expect(validezWarn).toBeDefined();
      expect(validezWarn?.line).toBe(5);
    });

    it('1e: calcula números de línea reales y precisos en vez de line: 1', () => {
      const yaml = `
# Encabezado largo
# Con varios comentarios
# Para desplazar líneas

cliente: Cliente Inexistente S.A.
factura: Factura A

Capítulo A:
  - 5 u Boca de Iluminación
`;
      const res = parseDSLToPresupuesto(yaml, {
        clientes: mockClientes,
        tareasTipo: mockTareas,
        insumosMap: mockInsumosMap,
        manoObraMap: mockManoObraMap
      });

      // El warning de cliente no encontrado debe reportarse en la línea del cliente, NO en línea 1
      const cliWarn = res.diagnostics.find((d) => d.message.includes('Cliente Inexistente S.A.'));
      expect(cliWarn).toBeDefined();
      expect(cliWarn?.line).toBe(6);

      // La partida debe reportarse en su línea real
      const itemInfo = res.diagnostics.find((d) => d.message.includes('Boca de Iluminación'));
      expect(itemInfo).toBeDefined();
      expect(itemInfo?.line).toBe(10);
    });
  });

  describe('Garantizar integridad estructural (Jerarquía 0/2/4/6/8, Tab, Enter, Paste, Lint)', () => {
    it('validateYamlStructure detecta bloques de despiece y atributos huérfanos o indentación impar', () => {
      const yaml = `
cliente: Federico Gómez
materiales:
  - 10 m Cable
Capítulo 1:
  cantidad: 20
   - 10 u Boca de Iluminación
`;
      const diags = validateYamlStructure(yaml);
      
      // 1. materiales: a nivel raíz (huérfano)
      const orphSec = diags.find((d) => d.message.includes('Bloque huérfano "materiales:" a nivel raíz'));
      expect(orphSec).toBeDefined();
      expect(orphSec?.line).toBe(3);

      // 2. cantidad: bajo capítulo sin partida (huérfano)
      const orphAttr = diags.find((d) => d.message.includes('Atributo huérfano "cantidad:"'));
      expect(orphAttr).toBeDefined();
      expect(orphAttr?.line).toBe(6);

      // 3. Indentación impar (3 espacios)
      const oddIndent = diags.find((d) => d.message.includes('Indentación impar (3 espacios)'));
      expect(oddIndent).toBeDefined();
      expect(oddIndent?.line).toBe(7);
    });

    it('handleYamlSmartEnter respeta estrictamente los niveles 0 -> 2 -> 4 -> 6 -> 8', () => {
      // Nivel 0 (Capítulo) -> Siguiente renglón es partida (Nivel 1: "  - ")
      const r1 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:',
        textAfter: ''
      });
      expect(r1.newText).toBe('Capítulo 1:\n  - ');

      // Nivel 1 (Partida que termina en ':') -> Siguiente renglón es sub-bloque materiales (Nivel 2: "    materiales:")
      const r2 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - 10 u Boca de Iluminación:',
        textAfter: ''
      });
      expect(r2.newText).toBe('Capítulo 1:\n  - 10 u Boca de Iluminación:\n    materiales:');

      // Nivel 1 (Partida normal sin ':') -> Siguiente renglón es partida hermana (Nivel 1: "  - ")
      const r3 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - 10 u Boca de Iluminación',
        textAfter: ''
      });
      expect(r3.newText).toBe('Capítulo 1:\n  - 10 u Boca de Iluminación\n  - ');

      // Nivel 2 (Sub-bloque "    materiales:") -> Siguiente renglón es ítem de despiece (Nivel 3: "      - ")
      const r4 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - Boca:\n    materiales:',
        textAfter: ''
      });
      expect(r4.newText).toBe('Capítulo 1:\n  - Boca:\n    materiales:\n      - ');

      // Nivel 3 (Ítem de despiece con ':') -> Siguiente renglón es atributo (Nivel 4: "        cantidad: ")
      const r5 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - Boca:\n    materiales:\n      - Cable 2.5 mm²:',
        textAfter: ''
      });
      expect(r5.newText).toBe('Capítulo 1:\n  - Boca:\n    materiales:\n      - Cable 2.5 mm²:\n        cantidad: ');

      // Nivel 4 (Atributo "        cantidad: 20") -> Siguiente renglón desindenta a ítem hermano (Nivel 3: "      - ")
      const r6 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - Boca:\n    materiales:\n      - Cable 2.5 mm²:\n        cantidad: 20',
        textAfter: ''
      });
      expect(r6.newText).toBe('Capítulo 1:\n  - Boca:\n    materiales:\n      - Cable 2.5 mm²:\n        cantidad: 20\n      - ');

      // Viñeta vacía de nivel 3 ("      - ") -> Desindenta a nivel 2 ("    ")
      const r7 = handleYamlSmartEnter({
        textBefore: 'Capítulo 1:\n  - Boca:\n    materiales:\n      - ',
        textAfter: ''
      });
      expect(r7.newText).toBe('Capítulo 1:\n  - Boca:\n    materiales:\n    ');
    });

    it('handleYamlSmartTab calcula niveles contextuales y cicla entre 0 -> 2 -> 4 -> 6 -> 8 -> 0', () => {
      // 1. En renglón vacío debajo de un capítulo (Nivel 0): salta al nivel contextual de partida (Nivel 1: "  - ")
      const t1 = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n',
        textAfter: ''
      });
      expect(t1.newText).toBe('Capítulo 1:\n  - ');

      // 2. Presionar Tab sucesivamente cicla entre los niveles:
      // Desde nivel 1 (2 espacios) cicla a nivel 2 (4 espacios)
      const t2 = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n  - ',
        textAfter: ''
      });
      expect(t2.newText).toBe('Capítulo 1:\n    ');

      // Desde nivel 2 (4 espacios) cicla a nivel 3 (6 espacios + "- ")
      const t3 = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n    ',
        textAfter: ''
      });
      expect(t3.newText).toBe('Capítulo 1:\n      - ');

      // Desde nivel 3 (6 espacios) cicla a nivel 4 (8 espacios)
      const t4 = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n      - ',
        textAfter: ''
      });
      expect(t4.newText).toBe('Capítulo 1:\n        ');

      // Desde nivel 4 (8 espacios) cicla a nivel 0 (0 espacios)
      const t5 = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n        ',
        textAfter: ''
      });
      expect(t5.newText).toBe('Capítulo 1:\n');

      // 3. Shift+Tab cicla hacia atrás:
      const tBack = handleYamlSmartTab({
        textBefore: 'Capítulo 1:\n        ',
        textAfter: '',
        shiftKey: true
      });
      expect(tBack.newText).toBe('Capítulo 1:\n      - ');
    });

    it('normalizePastedYaml remueve invisibles, convierte tabs a espacios y re-indenta según destino', () => {
      // 1. Limpieza de invisibles (zero-width space \u200B y BOM \uFEFF) y tabs
      const dirty = "\u200B\uFEFF- Cable 2.5 mm²:\t$ 1.500\n\tcantidad:\t10";
      const cleaned = normalizePastedYaml(dirty, '');
      expect(cleaned).not.toContain('\u200B');
      expect(cleaned).not.toContain('\uFEFF');
      expect(cleaned).not.toContain('\t');
      expect(cleaned).toContain('  ');

      // 2. Re-indentación multi-línea cuando el cursor está en una línea indentada (6 espacios)
      const snippet = `- Cable:\n    cantidad: 10\n- Disyuntor:\n    cantidad: 1`;
      const textBefore = `Capítulo 1:\n  - Boca:\n    materiales:\n      `; // 6 espacios
      const reindented = normalizePastedYaml(snippet, textBefore);

      // La primera línea se pega inmediatamente tras los 6 espacios existentes
      const lines = reindented.split('\n');
      expect(lines[0]).toBe('- Cable:');
      // La segunda línea (cantidad: 10) debe quedar a 6 + 4 = 10 espacios
      expect(lines[1]).toBe('          cantidad: 10');
      // La tercera línea (- Disyuntor:) debe quedar a 6 espacios
      expect(lines[2]).toBe('      - Disyuntor:');
      // La cuarta línea (cantidad: 1) debe quedar a 10 espacios
      expect(lines[3]).toBe('          cantidad: 1');
    });
  });

  describe('Sincronización Guiado ↔ Experto (serializePresupuestoToDSL, preservación de calculos y campos)', () => {
    it('extractCalculosBlockFromDsl extrae fielmente el bloque calculos: con variables, comentarios y fórmulas', () => {
      const dsl = `cliente: Federico Gómez
obra: Mitre 123

# Bloque de fórmulas matemáticas
calculos:
  # Área principal
  ancho: 12
  largo: 10
  superficie: =ancho * largo
  bocas: =superficie / 3

Iluminación:
  - 10 u Boca de Iluminación
`;
      const extracted = extractCalculosBlockFromDsl(dsl);
      expect(extracted).not.toBeNull();
      expect(extracted).toContain('calculos:');
      expect(extracted).toContain('ancho: 12');
      expect(extracted).toContain('superficie: =ancho * largo');
      expect(extracted).not.toContain('Iluminación:');
      expect(extracted).not.toContain('cliente:');
    });

    it('serializePresupuestoToDSL regenera el YAML tras ediciones en modo guiado preservando el bloque calculos:', () => {
      const originalDsl = `cliente: Federico Gómez
obra: Mitre 123

calculos:
  factor_seguridad: 1.2
  metros_cable: 150

Iluminación:
  - 10 u Boca de Iluminación: $ 12.000
`;
      // En modo guiado se agrega un nuevo ítem y se actualiza el cliente
      const nuevoCliente: Cliente = {
        id: 'cli-nuevo',
        nombre: 'Nuevo Cliente S.A.',
        razonSocial: 'Nuevo Cliente S.A.',
        roles: ['cliente']
      };

      const updatedItems: Partial<ItemPresupuesto>[] = [
        {
          id: 'it-1',
          descripcion: 'Boca de Iluminación',
          cantidad: 10,
          unidad: 'u',
          costoUnitario: 12000,
          precioManual: 12000,
          capituloId: 'cap-1'
        },
        {
          id: 'it-2',
          descripcion: 'Tomacorriente Doble',
          cantidad: 8,
          unidad: 'u',
          costoUnitario: 9500,
          precioManual: 9500,
          capituloId: 'cap-1'
        }
      ];

      const capitulos: CapituloPresupuesto[] = [
        { id: 'cap-1', nombre: 'Iluminación y Tomas', orden: 1 }
      ];

      const regeneratedDsl = serializePresupuestoToDSL({
        clienteId: nuevoCliente.id,
        direccionObra: 'Mitre 123',
        tipoFactura: 'Factura A',
        validezDias: 30,
        margenPorcentaje: 35,
        nivelMargenRiesgo: 'medio',
        items: updatedItems as ItemPresupuesto[],
        capitulos,
        clientes: [nuevoCliente],
        forceRegenerate: true,
        preserveCalculosFromDsl: originalDsl
      });

      // 1. Debe contener el nuevo cliente
      expect(regeneratedDsl).toContain('cliente: Nuevo Cliente S.A.');

      // 2. Debe contener el bloque calculos: original preservado
      expect(regeneratedDsl).toContain('calculos:');
      expect(regeneratedDsl).toContain('factor_seguridad: 1.2');
      expect(regeneratedDsl).toContain('metros_cable: 150');

      // 3. Debe contener el nuevo ítem agregado en modo guiado
      expect(regeneratedDsl).toContain('8 u Tomacorriente Doble');
      expect(regeneratedDsl).toContain('10 u Boca de Iluminación');
    });

    it('serializePresupuestoToDSL genera la jerarquía semántica estándar 0/2/4/6/8 para ítems con despiece', () => {
      const itemsConDespiece: Partial<ItemPresupuesto>[] = [
        {
          id: 'it-comp',
          descripcion: 'Tablero Seccional Embutido',
          cantidad: 1,
          unidad: 'u',
          esAdHoc: true,
          capituloId: 'cap-tableros',
          insumosSnapshot: [
            {
              insumoId: 'mat-gabinete',
              nombre: 'Gabinete 24 Polos',
              unidad: 'u',
              cantidadTotal: 1,
              precioUnitarioCongelado: 25000,
              subtotalInsumo: 25000
            }
          ],
          manoObraSnapshot: [
            {
              categoriaId: 'mo-oficial',
              nombreCategoria: 'Oficial Electricista',
              horasTotales: 6,
              costoHoraCongelado: 4500,
              subtotalManoObra: 27000
            }
          ]
        }
      ];

      const dsl = serializePresupuestoToDSL({
        items: itemsConDespiece as ItemPresupuesto[],
        capitulos: [{ id: 'cap-tableros', nombre: 'Tableros', orden: 1 }],
        forceRegenerate: true
      });

      // Nivel 0: Capítulo "Tableros:"
      expect(dsl).toContain('Tableros:');
      // Nivel 1: Partida "  - Tablero Seccional Embutido:" (2 espacios)
      expect(dsl).toContain('  - Tablero Seccional Embutido:');
      // Nivel 2: Sub-bloque "    materiales:" (4 espacios)
      expect(dsl).toContain('    materiales:');
      // Nivel 3: Despiece "      - 1 u Gabinete 24 Polos" (6 espacios + "- ")
      expect(dsl).toContain('      - 1 u Gabinete 24 Polos');
      // Nivel 2: Sub-bloque "    mano_obra:" (4 espacios)
      expect(dsl).toContain('    mano_obra:');
      // Nivel 3: Despiece "      - 6 h Oficial Electricista" (6 espacios + "- ")
      expect(dsl).toContain('      - 6 h Oficial Electricista');
    });
  });
});




