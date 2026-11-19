import { describe, it, expect } from 'vitest';
import {
  NotebookBlock,
  NotebookParseContext,
  parse,
  serialize,
} from './notebookParser';
import {
  CategoriaManoDeObra,
  Material,
  Producto,
  TareaTipo,
} from './types';

const mockMateriales: Material[] = [
  {
    id: 'mat-cable-25-celeste',
    categoriaId: 'cat-cables',
    nombre: 'Cable Unipolar 2.5mm² Celeste',
    unidadVenta: 'm',
    atributos: [
      { clave: 'seccion', valor: '2.5' },
      { clave: 'color', valor: 'celeste' },
    ],
    activo: true,
  },
  {
    id: 'mat-cable-25-marron',
    categoriaId: 'cat-cables',
    nombre: 'Cable Unipolar 2.5mm² Marrón',
    unidadVenta: 'm',
    atributos: [
      { clave: 'seccion', valor: '2.5' },
      { clave: 'color', valor: 'marron' },
    ],
    activo: true,
  },
  {
    id: 'mat-canaleta',
    categoriaId: 'cat-cablecanales',
    nombre: 'Canaleta PVC 20x10',
    unidadVenta: 'm',
    atributos: [{ clave: 'medida', valor: '20x10' }],
    activo: true,
  },
];

const mockProductos: Producto[] = [
  {
    id: 'prod-prysmian-25',
    materialId: 'mat-cable-25-celeste',
    marca: 'Prysmian',
    modelo: 'Superastic',
    esPreferido: true,
    activo: true,
  },
  {
    id: 'prod-kalop-25',
    materialId: 'mat-cable-25-celeste',
    marca: 'Kalop',
    modelo: 'Flex',
    esPreferido: false,
    activo: true,
  },
];

const mockManoObra: CategoriaManoDeObra[] = [
  {
    id: 'mo-oficial-elec',
    nombre: 'Oficial Electricista',
    costoHora: 8000,
    fechaActualizacion: '2026-10-01',
  },
  {
    id: 'mo-oficial-esp',
    nombre: 'Oficial Especializado',
    costoHora: 9500,
    fechaActualizacion: '2026-10-01',
  },
  {
    id: 'mo-ayudante',
    nombre: 'Ayudante',
    costoHora: 5500,
    fechaActualizacion: '2026-10-01',
  },
];

const mockTareasTipo: TareaTipo[] = [
  {
    id: 'tt-recableado',
    nombre: 'Recableado Completo',
    slug: 'recableado-completo',
    categoria: 'Circuitos',
    unidad: 'gl',
    parametros: [
      { id: 'sup', nombre: 'Superficie', tipo: 'numero', valorDefault: 50 },
      { id: 'bocas', nombre: 'Bocas', tipo: 'numero', valorDefault: 15 },
    ],
    supuestos: [
      {
        id: 'caneria',
        nombre: 'Estado cañería',
        opciones: ['original', 'verificada', 'no_verificada', 'no_aplica'],
        valorDefault: 'no_verificada',
      },
    ],
    insumos: [],
    manoObra: [],
  },
  {
    id: 'tt-tablero',
    nombre: 'Cambio de Tablero',
    slug: 'cambio-tablero',
    categoria: 'Tableros',
    unidad: 'u',
    parametros: [
      { id: 'circuitos', nombre: 'Circuitos', tipo: 'numero', valorDefault: 6 },
    ],
    insumos: [],
    manoObra: [],
  },
];

const ctx: NotebookParseContext = {
  tareasTipo: mockTareasTipo,
  materiales: mockMateriales,
  productos: mockProductos,
  manoObra: mockManoObra,
};

describe('notebookParser (Fase 2)', () => {
  describe('casos válidos', () => {
    it('parsea la sintaxis completa de referencia del notebook', () => {
      const input = [
        'sup = 60',
        'bocas = 24',
        '',
        '# Instalaciones eléctricas',
        '/tt recableado-completo  sup=sup  bocas=bocas  -puesta-a-tierra  +canaleta 20m',
        '/tt cambio-tablero  circuitos=8',
        'tarea: Reubicar medidor',
        'cable 2.5 celeste  120m',
        'item: Apertura de canaleta  1 gl  45000',
      ].join('\n');

      const res = parse(input, ctx);
      expect(res.valido).toBe(true);
      expect(res.errores).toEqual([]);
      expect(res.bloques).toEqual([
        { tipo: 'variable', id: 'sup', expresion: '60' },
        { tipo: 'variable', id: 'bocas', expresion: '24' },
        { tipo: 'capitulo', nombre: 'Instalaciones eléctricas' },
        {
          tipo: 'tarea_tipo',
          referencia: 'recableado-completo',
          tareaTipoId: 'tt-recableado',
          overridesParametros: { sup: 'sup', bocas: 'bocas' },
          quitados: ['puesta-a-tierra'],
          agregados: [
            {
              referencia: 'Canaleta PVC 20x10',
              materialId: 'mat-canaleta',
              cantidad: 20,
              unidad: 'm',
            },
          ],
          lineas: [],
        },
        {
          tipo: 'tarea_tipo',
          referencia: 'cambio-tablero',
          tareaTipoId: 'tt-tablero',
          overridesParametros: { circuitos: 8 },
          quitados: [],
          agregados: [],
          lineas: [],
        },
        {
          tipo: 'item_libre',
          modo: 'tarea',
          descripcion: 'Reubicar medidor',
          parametros: {},
          lineas: [
            {
              tipo: 'material',
              referencia: 'Cable Unipolar 2.5mm² Celeste',
              materialId: 'mat-cable-25-celeste',
              cantidad: 120,
              unidad: 'm',
            },
          ],
        },
        {
          tipo: 'item_libre',
          modo: 'item',
          descripcion: 'Apertura de canaleta',
          cantidad: 1,
          unidad: 'gl',
          precioUnitario: 45000,
          parametros: {},
          lineas: [],
        },
      ]);
    });

    it('soporta supuestos, notas internas, producto explícito, mano de obra y servicios dentro de ítem', () => {
      const input = [
        'supuesto: caneria = verificada',
        'nota: Coordinar corte de luz con consorcio',
        'tarea: Acometida principal',
        '  cable 2.5 celeste [Prysmian Superastic]  (sup * 2)m',
        '  mo: Oficial Electricista  4.5h',
        '  serv: Flete materiales  1 gl  18000',
      ].join('\n');

      const res = parse(input, ctx);
      expect(res.valido).toBe(true);
      expect(res.bloques[0]).toEqual({ tipo: 'supuesto', clave: 'caneria', valor: 'verificada' });
      expect(res.bloques[1]).toEqual({ tipo: 'nota_interna', texto: 'Coordinar corte de luz con consorcio' });

      const tarea = res.bloques[2];
      expect(tarea.tipo).toBe('item_libre');
      if (tarea.tipo === 'item_libre') {
        expect(tarea.lineas).toEqual([
          {
            tipo: 'material',
            referencia: 'Cable Unipolar 2.5mm² Celeste',
            materialId: 'mat-cable-25-celeste',
            productoId: 'prod-prysmian-25',
            productoReferencia: 'Prysmian Superastic',
            formulaCantidad: 'sup * 2',
            unidad: 'm',
          },
          {
            tipo: 'mano_obra',
            referencia: 'Oficial Electricista',
            categoriaId: 'mo-oficial-elec',
            horas: 4.5,
            unidad: 'h',
          },
          {
            tipo: 'servicio',
            descripcion: 'Flete materiales',
            cantidad: 1,
            unidad: 'gl',
            costoUnitario: 18000,
          },
        ]);
      }
    });
  });

  describe('referencias ambiguas (nunca adivina)', () => {
    it('marca error ambiguo con candidatos cuando "cable 2.5" coincide con múltiples materiales', () => {
      const input = ['tarea: Circuito tomas', 'cable 2.5  50m'].join('\n');
      const res = parse(input, ctx);

      expect(res.valido).toBe(false);
      expect(res.errores).toHaveLength(1);
      expect(res.errores[0].codigo).toBe('ambiguo');
      expect(res.errores[0].linea).toBe(2);
      expect(res.errores[0].candidatos).toEqual([
        'Cable Unipolar 2.5mm² Celeste',
        'Cable Unipolar 2.5mm² Marrón',
      ]);
    });

    it('marca error ambiguo en mano de obra si la referencia no es unívoca', () => {
      const input = ['tarea: Tablero', 'mo: oficial  3h'].join('\n');
      const res = parse(input, ctx);

      expect(res.valido).toBe(false);
      expect(res.errores[0].codigo).toBe('ambiguo');
      expect(res.errores[0].candidatos).toEqual([
        'Oficial Electricista',
        'Oficial Especializado',
      ]);
    });
  });

  describe('errores visibles (no se tragan silenciosamente)', () => {
    it('reporta typos en directivas con línea y columna', () => {
      const input = ['/t recableado-completo', 'tareaa: Medidor', 'itme: Canaleta  1 gl'].join('\n');
      const res = parse(input, ctx);

      expect(res.valido).toBe(false);
      expect(res.errores).toHaveLength(3);
      expect(res.errores[0]).toMatchObject({ linea: 1, columna: 1, codigo: 'directiva_desconocida' });
      expect(res.errores[1]).toMatchObject({ linea: 2, columna: 1, codigo: 'directiva_desconocida' });
      expect(res.errores[2]).toMatchObject({ linea: 3, columna: 1, codigo: 'directiva_desconocida' });
    });

    it('reporta cantidades inválidas, unidades desconocidas y referencias inexistentes', () => {
      const input = [
        'tarea: Prueba errores',
        'cable 2.5 celeste  0m',
        'cable 2.5 celeste  120metros_raros',
        'cabel 2.5 celeste  10m',
        '/tt trabajo-fantasma',
      ].join('\n');

      const res = parse(input, ctx);
      expect(res.valido).toBe(false);
      expect(res.errores.map((e) => e.codigo)).toEqual([
        'cantidad_invalida',
        'unidad_desconocida',
        'referencia_inexistente',
        'referencia_inexistente',
      ]);
      expect(res.errores.map((e) => e.linea)).toEqual([2, 3, 4, 5]);
    });

    it('reporta parámetros desconocidos, supuestos inválidos, nombre reservado y líneas fuera de ítem', () => {
      const input = [
        'cantidad = 5',
        'supuesto: caneria = destruida',
        '/tt cambio-tablero  param_inexistente=10',
        '',
        'cable 2.5 celeste  10m',
        'mo: Oficial Electricista  2h',
        'bad = 1 + * 2',
      ].join('\n');

      const res = parse(input, ctx);
      expect(res.valido).toBe(false);
      expect(res.errores.map((e) => e.codigo)).toEqual([
        'nombre_reservado',
        'valor_supuesto_invalido',
        'parametro_desconocido',
        'linea_fuera_de_item',
        'linea_fuera_de_item',
        'expresion_invalida',
      ]);
    });
  });

  describe('round-trip garantizado', () => {
    it('parse(serialize(x)) equivale exactamente a x para todos los tipos de bloque', () => {
      const original: NotebookBlock[] = [
        { tipo: 'variable', id: 'sup', expresion: '60' },
        { tipo: 'variable', id: 'bocas', expresion: 'ceil(sup * 0.4)' },
        { tipo: 'supuesto', clave: 'caneria', valor: 'no_verificada' },
        { tipo: 'nota_interna', texto: 'Revisar bajada principal en visita' },
        { tipo: 'capitulo', nombre: 'Instalaciones eléctricas' },
        {
          tipo: 'tarea_tipo',
          referencia: 'recableado-completo',
          tareaTipoId: 'tt-recableado',
          cantidad: 2,
          overridesParametros: { sup: 'sup', bocas: 'bocas' },
          quitados: ['puesta-a-tierra'],
          agregados: [
            {
              referencia: 'Canaleta PVC 20x10',
              materialId: 'mat-canaleta',
              cantidad: 20,
              unidad: 'm',
            },
          ],
          lineas: [],
        },
        {
          tipo: 'item_libre',
          modo: 'tarea',
          descripcion: 'Reubicar medidor',
          parametros: {},
          lineas: [
            {
              tipo: 'material',
              referencia: 'Cable Unipolar 2.5mm² Celeste',
              materialId: 'mat-cable-25-celeste',
              productoId: 'prod-prysmian-25',
              productoReferencia: 'Prysmian Superastic',
              cantidad: 120,
              unidad: 'm',
            },
            {
              tipo: 'mano_obra',
              referencia: 'Oficial Electricista',
              categoriaId: 'mo-oficial-elec',
              formulaHoras: 'bocas * 0.5',
              unidad: 'h',
            },
            {
              tipo: 'servicio',
              descripcion: 'Flete y acarreo',
              cantidad: 1,
              unidad: 'gl',
              costoUnitario: 25000,
            },
          ],
        },
        {
          tipo: 'item_libre',
          modo: 'item',
          descripcion: 'Apertura de canaleta',
          formulaCantidad: 'sup * 0.5',
          unidad: 'm',
          formulaPrecio: '1200 * factor',
          parametros: { factor: 1.2 },
          lineas: [],
        },
      ];

      const texto1 = serialize(original, ctx);
      const parsed = parse(texto1, ctx);

      expect(parsed.valido).toBe(true);
      expect(parsed.errores).toEqual([]);
      expect(parsed.bloques).toEqual(original);

      const texto2 = serialize(parsed.bloques, ctx);
      expect(texto2).toBe(texto1);
    });

    it('soporta parámetros indentados multilínea, comentarios // y serialización indentada legible', () => {
      const textoIndentado = [
        '// Comentario explicativo en línea libre',
        '/tt recableado-completo',
        '  // Comentario dentro de bloque',
        '  sup = 85',
        '  bocas = 24',
        '  -cableado',
        '  +Cable Unipolar 2.5mm² Celeste',
        '    marca = Prysmian Superastic',
        '    cantidad = 30m',
        'tarea: Armado de tablero',
        '  mat: Cable Unipolar 2.5mm² Celeste',
        '    marca = Prysmian Superastic',
        '    cantidad = 120m',
        '  mo: Oficial Electricista',
        '    horas = 4.5hs',
        '  serv: Flete y acarreo',
        '    cantidad = 1gl',
        '    costo = 25000',
        'item: Visita técnica en obra',
        '  cantidad = 2u',
        '  precio = 15000',
      ].join('\n');

      const parsed = parse(textoIndentado, ctx);
      expect(parsed.valido).toBe(true);
      expect(parsed.bloques).toHaveLength(3);
      expect(parsed.bloques[0]).toMatchObject({
        tipo: 'tarea_tipo',
        overridesParametros: { sup: 85, bocas: 24 },
        quitados: ['cableado'],
        agregados: [
          expect.objectContaining({
            referencia: 'Cable Unipolar 2.5mm² Celeste',
            productoReferencia: 'Prysmian Superastic',
            cantidad: 30,
            unidad: 'm',
          }),
        ],
      });
      expect(parsed.bloques[1]).toMatchObject({
        tipo: 'item_libre',
        modo: 'tarea',
        descripcion: 'Armado de tablero',
        lineas: [
          expect.objectContaining({
            tipo: 'material',
            productoReferencia: 'Prysmian Superastic',
            cantidad: 120,
            unidad: 'm',
          }),
          expect.objectContaining({
            tipo: 'mano_obra',
            horas: 4.5,
            unidad: 'hs',
          }),
          expect.objectContaining({
            tipo: 'servicio',
            descripcion: 'Flete y acarreo',
            cantidad: 1,
            unidad: 'gl',
            costoUnitario: 25000,
          }),
        ],
      });
      expect(parsed.bloques[2]).toMatchObject({
        tipo: 'item_libre',
        modo: 'item',
        descripcion: 'Visita técnica en obra',
        cantidad: 2,
        unidad: 'u',
        precioUnitario: 15000,
      });

      const out = serialize(parsed.bloques, ctx);
      expect(out).toBe([
        '/tt recableado-completo',
        '  sup = 85',
        '  bocas = 24',
        '  -cableado',
        '  +Cable Unipolar 2.5mm² Celeste',
        '    marca = Prysmian Superastic',
        '    cantidad = 30m',
        'tarea: Armado de tablero',
        '  mat: Cable Unipolar 2.5mm² Celeste',
        '    marca = Prysmian Superastic',
        '    cantidad = 120m',
        '  mo: Oficial Electricista',
        '    horas = 4.5hs',
        '  serv: Flete y acarreo',
        '    cantidad = 1gl',
        '    costo = 25000',
        'item: Visita técnica en obra',
        '  cantidad = 2u',
        '  precio = 15000',
      ].join('\n'));
    });

    it('soporta sintaxis natural sin paréntesis, unidades opcionales en variables y cantidad con fórmula en /tt y tarea:', () => {
      const textoNatural = [
        'largo = 12 m',
        'ancho = 5m',
        'sup = largo * ancho m2',
        'bocas = ceil(sup * 0.3) u',
        'tarifa = 4500',
        '/tt recableado-completo',
        '  cantidad = 2 + 1',
        '  sup = largo * ancho',
        '  bocas = bocas + 2',
        'tarea: Tablero seccional',
        '  cantidad = 2 u',
        '  circuitos = 8',
        '  metros = circuitos * 5',
        '  mat: Cable Unipolar 2.5mm² Celeste',
        '    cantidad = metros * 1.1 m',
        '  mo: Oficial Electricista',
        '    horas = circuitos * 0.5 hs',
        '  serv: Ensayo de aislación',
        '    cantidad = circuitos u',
        '    costo = tarifa * 1.2',
        'item: Canalización extra',
        '  cantidad = largo * 2 m',
        '  precio = tarifa * 1.15',
      ].join('\n');

      const parsed = parse(textoNatural, ctx);
      expect(parsed.errores).toEqual([]);
      expect(parsed.valido).toBe(true);

      expect(parsed.bloques[0]).toEqual({ tipo: 'variable', id: 'largo', expresion: '12', unidad: 'm' });
      expect(parsed.bloques[1]).toEqual({ tipo: 'variable', id: 'ancho', expresion: '5', unidad: 'm' });
      expect(parsed.bloques[2]).toEqual({ tipo: 'variable', id: 'sup', expresion: 'largo * ancho', unidad: 'm2' });
      expect(parsed.bloques[3]).toEqual({ tipo: 'variable', id: 'bocas', expresion: 'ceil(sup * 0.3)', unidad: 'u' });

      expect(parsed.bloques[5]).toMatchObject({
        tipo: 'tarea_tipo',
        formulaCantidad: '2 + 1',
        overridesParametros: { sup: 'largo * ancho', bocas: 'bocas + 2' },
      });

      expect(parsed.bloques[6]).toMatchObject({
        tipo: 'item_libre',
        modo: 'tarea',
        cantidad: 2,
        unidad: 'u',
        parametros: { circuitos: 8, metros: 'circuitos * 5' },
        lineas: [
          expect.objectContaining({ tipo: 'material', formulaCantidad: 'metros * 1.1', unidad: 'm' }),
          expect.objectContaining({ tipo: 'mano_obra', formulaHoras: 'circuitos * 0.5', unidad: 'hs' }),
          expect.objectContaining({ tipo: 'servicio', formulaCantidad: 'circuitos', unidad: 'u', formulaCosto: 'tarifa * 1.2' }),
        ],
      });

      expect(parsed.bloques[7]).toMatchObject({
        tipo: 'item_libre',
        modo: 'item',
        formulaCantidad: 'largo * 2',
        unidad: 'm',
        formulaPrecio: 'tarifa * 1.15',
      });

      // Round-trip determinista
      const reserialized = serialize(parsed.bloques, ctx);
      const reparsed = parse(reserialized, ctx);
      expect(reparsed.errores).toEqual([]);
      expect(reparsed.bloques).toEqual(parsed.bloques);
    });

    it('no confunde identificadores tras operadores (bocas + m) con unidades y reporta unidades inválidas en fórmulas', () => {
      const okText = [
        'm = 4',
        'bocas = 10',
        'tarea: Prueba operadores',
        '  mat: Cable Unipolar 2.5mm² Celeste',
        '    cantidad = bocas + m',
      ].join('\n');
      const okRes = parse(okText, ctx);
      expect(okRes.errores).toEqual([]);
      const tarea = okRes.bloques[2];
      expect(tarea.tipo).toBe('item_libre');
      if (tarea.tipo === 'item_libre') {
        expect(tarea.lineas[0]).toMatchObject({
          formulaCantidad: 'bocas + m',
          unidad: 'm',
        });
      }

      const badUnitText = [
        'tarea: Prueba unidad invalida',
        '  mat: Cable Unipolar 2.5mm² Celeste',
        '    cantidad = bocas * 2 metros_raros',
      ].join('\n');
      const badRes = parse(badUnitText, ctx);
      expect(badRes.valido).toBe(false);
      expect(badRes.errores[0]).toMatchObject({
        linea: 3,
        codigo: 'unidad_desconocida',
      });
    });
  });
});
