import {
  Insumo,
  CategoriaManoDeObra,
  CostoIndirecto,
  TareaTipo,
  Cliente,
  AppConfig
} from './types';

const now = new Date().toISOString();

export const DEFAULT_APP_CONFIG: AppConfig = {
  id: 'config-main',
  nombreEmpresa: 'IEBA — Instalaciones Eléctricas',
  subtituloEmpresa: 'Ingeniería, Montajes & Tableros Industriales',
  cuit: '20-34567890-9',
  telefono: '+54 9 11 5555-1234',
  email: 'contacto@ieba.com.ar',
  direccion: 'Buenos Aires, Argentina',
  dolarReferenciaNombre: 'USD Blue',
  dolarReferenciaValor: 1350,
  mostrarDolarPorDefecto: true,
  monotributista: true,
  tipoFacturaPorDefecto: 'Factura B',
  porcentajeIVAPorDefecto: 21,
  porcentajeIIBBPorDefecto: 3.5,
  margenPorDefectoPct: 35,
  validezDiasPorDefecto: 15,
  prefijoPresupuesto: 'IEBA',
  siguienteNumeroCorrelativo: 1001
};

export const INITIAL_INSUMOS: Insumo[] = [
  {
    id: 'ins-c25',
    nombre: 'Cable Unipolar 2.5mm² IRAM 247-3 (Mortero/Prysmian)',
    unidad: 'm',
    categoria: 'cableado',
    proveedorPreferido: 'Distribuidora Eléctrica Central',
    precioActual: 720,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 720, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-c15',
    nombre: 'Cable Unipolar 1.5mm² IRAM 247-3',
    unidad: 'm',
    categoria: 'cableado',
    proveedorPreferido: 'Distribuidora Eléctrica Central',
    precioActual: 480,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 480, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-c40',
    nombre: 'Cable Unipolar 4.0mm² IRAM 247-3',
    unidad: 'm',
    categoria: 'cableado',
    precioActual: 1150,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 1150, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-term-2x16',
    nombre: 'Llave Termomagnética 2x16A 3kA (Schneider/ABB)',
    unidad: 'u',
    categoria: 'protecciones',
    precioActual: 14500,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 14500, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-term-2x25',
    nombre: 'Llave Termomagnética 2x25A 3kA (Schneider/ABB)',
    unidad: 'u',
    categoria: 'protecciones',
    precioActual: 15200,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 15200, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-disy-2x40',
    nombre: 'Interruptor Diferencial 2x40A 30mA (Schneider Superinmunizado/Clásico)',
    unidad: 'u',
    categoria: 'protecciones',
    precioActual: 42000,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 42000, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-caja-octo',
    nombre: 'Caja Octogonal Chapa Reforzada 18',
    unidad: 'u',
    categoria: 'cajas',
    precioActual: 980,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 980, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-caja-rect',
    nombre: 'Caja Rectangular 5x10 Chapa Reforzada',
    unidad: 'u',
    categoria: 'cajas',
    precioActual: 850,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 850, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-caño-3/4',
    nombre: 'Caño Corrugado Blanco Ignífugo 3/4" (Rollo de 25m)',
    unidad: 'm',
    categoria: 'canalizaciones',
    precioActual: 450,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 450, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-llave-armada',
    nombre: 'Módulo Llave de Luz Armada 1 Tecla + Bastidor (Jeluz/Sica)',
    unidad: 'u',
    categoria: 'accesorios',
    precioActual: 3800,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 3800, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-toma-20a',
    nombre: 'Tomacorriente 20A Reforzado Aire/Horno',
    unidad: 'u',
    categoria: 'accesorios',
    precioActual: 4900,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 4900, fuente: 'Carga Semilla Inicial' }]
  },
  {
    id: 'ins-tablero-12m',
    nombre: 'Gabinete Embutir/Exterior 12 Módulos IP40 con Din',
    unidad: 'u',
    categoria: 'cajas',
    precioActual: 18900,
    fechaActualizacion: now,
    historialPrecios: [{ fecha: now, precio: 18900, fuente: 'Carga Semilla Inicial' }]
  }
];

export const INITIAL_MANO_OBRA: CategoriaManoDeObra[] = [
  {
    id: 'mo-oficial',
    nombre: 'Oficial Electricista Matriculado / DCI',
    costoHora: 9500,
    fechaActualizacion: now
  },
  {
    id: 'mo-ayudante',
    nombre: 'Ayudante Electricista',
    costoHora: 5800,
    fechaActualizacion: now
  }
];

export const INITIAL_COSTOS_INDIRECTOS: CostoIndirecto[] = [
  {
    id: 'ci-viaticos',
    nombre: 'Combustible & Traslados Obra',
    tipo: 'por_visita',
    valor: 18000
  },
  {
    id: 'ci-herramientas',
    nombre: 'Amortización Herramientas & Seguridad',
    tipo: 'porcentual_sobre_costo',
    valor: 5
  },
  {
    id: 'ci-monotributo',
    nombre: 'Gastos Administrativos / Monotributo prorrateado',
    tipo: 'fijo_mensual',
    valor: 12000
  }
];

export const INITIAL_TAREAS_TIPO: TareaTipo[] = [
  {
    id: 'tt-boca-ilum',
    nombre: 'Boca de Iluminación Completa (IUG)',
    categoria: 'Bocas',
    unidad: 'punto',
    notasTecnicas: 'Incluye caja octogonal, 12m caño corrugado, 20m cable 1.5mm², caja 5x10 y armado de tecla.',
    insumos: [
      { insumoId: 'ins-caja-octo', cantidad: 1 },
      { insumoId: 'ins-caja-rect', cantidad: 1 },
      { insumoId: 'ins-caño-3/4', cantidad: 12 },
      { insumoId: 'ins-c15', cantidad: 20 },
      { insumoId: 'ins-llave-armada', cantidad: 1 }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial', horas: 1.2 },
      { categoriaId: 'mo-ayudante', horas: 1.0 }
    ]
  },
  {
    id: 'tt-boca-tug',
    nombre: 'Boca de Tomacorriente General (TUG)',
    categoria: 'Bocas',
    unidad: 'punto',
    notasTecnicas: 'Caja rectangular 5x10, caño corrugado, cable 2.5mm² y bastidor armado.',
    insumos: [
      { insumoId: 'ins-caja-rect', cantidad: 1 },
      { insumoId: 'ins-caño-3/4', cantidad: 10 },
      { insumoId: 'ins-c25', cantidad: 24 },
      { insumoId: 'ins-llave-armada', cantidad: 1 }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial', horas: 1.0 },
      { categoriaId: 'mo-ayudante', horas: 0.8 }
    ]
  },
  {
    id: 'tt-tablero-12m',
    nombre: 'Armado y Montaje de Tablero Seccional 12 Módulos',
    categoria: 'Tableros',
    unidad: 'u',
    notasTecnicas: 'Gabinete 12M, 1 Disyuntor 2x40A, 2 Térmicas 2x16A/2x25A y peineta de interconexión.',
    insumos: [
      { insumoId: 'ins-tablero-12m', cantidad: 1 },
      { insumoId: 'ins-disy-2x40', cantidad: 1 },
      { insumoId: 'ins-term-2x16', cantidad: 1 },
      { insumoId: 'ins-term-2x25', cantidad: 1 },
      { insumoId: 'ins-c40', cantidad: 6 }
    ],
    manoObra: [
      { categoriaId: 'mo-oficial', horas: 3.5 },
      { categoriaId: 'mo-ayudante', horas: 2.0 }
    ]
  }
];

export const INITIAL_CLIENTES: Cliente[] = [
  {
    id: 'cli-1',
    nombre: 'Estudio de Arquitectura Palermo SRL',
    cuitDni: '30-71234567-8',
    condicionIVA: 'Responsable Inscripto',
    telefono: '+54 9 11 4433-2211',
    email: 'obras@estudiopalermo.com',
    direccion: 'Av. Coronel Díaz 2450, CABA',
    notas: 'Cliente corporativo recurrente. Pagos a 15 días.'
  },
  {
    id: 'cli-2',
    nombre: 'Ing. Carlos Rossi (Residencial)',
    cuitDni: '20-18990011-4',
    condicionIVA: 'Consumidor Final',
    telefono: '+54 9 11 6789-0123',
    email: 'carlos.rossi@gmail.com',
    direccion: 'Barrio Privado Los Olivos, Lote 45, Tigre',
    notas: 'Casa en construcción 220m2.'
  }
];

export const INITIAL_PROVEEDORES: any[] = [
  {
    id: 'prov-1',
    nombre: 'Distribuidora Eléctrica Central SA',
    cuit: '30-68991122-3',
    telefono: '+54 9 11 4300-9900',
    email: 'ventas@electricacentral.com.ar',
    contacto: 'Mariano López (Asesor Comercial)',
    direccion: 'Av. Warnes 1540, CABA',
    notas: 'Proveedor mayorista principal de cables IRAM y térmicas Schneider. Descuento 8% pago contado.'
  },
  {
    id: 'prov-2',
    nombre: 'Electro Materiales Sur SRL',
    cuit: '30-70554433-1',
    telefono: '+54 9 11 4244-1122',
    email: 'pedidos@electrosur.com.ar',
    contacto: 'Guillermo Fernández',
    direccion: 'Av. Hipólito Yrigoyen 8900, Lomas de Zamora',
    notas: 'Especialista en canalizaciones, caño corrugado ignífugo y gabinetes.'
  }
];
