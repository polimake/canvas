/**
 * Calendario de arranque de Restaurante Jota Ele (Murcia): series, etiquetas,
 * contenidos de septiembre y octubre de 2026, y su diseño en canvas2.
 *
 * QUÉ ES CADA COSA
 *
 * Las SERIES son las etiquetas del proyecto (`projects.workflowTags`) y cada
 * pieza lleva la suya en `content.tags`. Tres las pidió el cliente — 1981, La
 * Barra y La Bodega — y la cuarta, Sugerencias, es el pulso semanal de la carta.
 *
 * Hubo dos más, En Casa y Regala Jota Ele, sacadas de la web. El cliente las
 * descartó por no relevantes. Sus tres huecos NO se dejan vacíos: pasan a las
 * series que sí interesan, para no bajar el volumen acordado.
 *
 * DE DÓNDE SALE EL COPY
 *
 * Solo de jotaelerestaurante.com: la fecha de 1981, Francisco González desde
 * 1986, la dirección, el teléfono, los platos de la carta de sugerencias y las
 * referencias de la bodega. Nada está inventado. Donde hacía falta un dato que
 * la web no da (horarios de barra, plazos de encargo, precios), la pieza se
 * escribe como BRIEF con el hueco entre corchetes en vez de rellenarlo a ojo:
 * es un calendario para revisar con el cliente, no para publicar a ciegas.
 *
 * VOLUMEN
 *
 * 12 piezas en septiembre y 14 en octubre (4 series). Sale del percentil medio de los
 * restaurantes que ya están en la casa (Barbecho 10,7/mes · Ciconea 10,0 ·
 * Paella Power 11,4 · Keriba 13,8 · El Invernadero 19,3), no de un número
 * redondo. Reels bajos a propósito: el público objetivo es local y de 35 a 65,
 * donde las stories mueven mesa entre semana.
 *
 * NO ESCRIBE EN LA BASE DE DATOS: emite SQL + rollback + informe.
 *
 * Uso: npx tsx packages/canvas2/scripts/design-jotaele.ts <dirSalida>
 */
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  ARQUETIPOS, alternativas, base, carasDe, nid,
  type Arquetipo, type Ctx, type El, type Marca, type Pieza,
} from './lib/design-system';

const SANDBOX = 'c26a8b61-3da8-45ea-b888-4cad00c00a0e';
const PROYECTO = 'ff2a1c58-4d1b-4f9e-9c3a-6b5e0d7a1f42';
const MM = '65ed1d7a-a16c-4949-8ee2-e85cbbbd57f1';
const OWNER = 'usr_2ed033dba4e4ded6728894e0114474ea';
const NOW = '2026-07-30T13:00:00.000Z';

const DIR = process.argv[2];
if (!DIR) {
  console.error('uso: design-jotaele.ts <dirSalida>');
  process.exit(1);
}

/**
 * Marca de la casa. Montserrat es la tipografía REAL de su web, y está en la
 * lista curada, así que aquí no hay sustitución que declarar. El negro y los
 * grises salen de la propia web; no hay color de marca documentado más allá de
 * eso, y por eso el acento es un gris claro y no un color inventado.
 */
const JOTAELE: Marca = {
  sandboxProject: PROYECTO,
  mmProject: MM,
  heading: 'Montserrat',
  body: 'Montserrat',
  color: '#202020',
  paleta: ['#202020', '#ffffff', '#69727d', '#d5d8dc'],
  fondo: '#202020',
  tinta: '#ffffff',
  realce: '#d5d8dc',
};

// ─── Series (etiquetas del proyecto) ──────────────────────────────────────────

const SERIES = [
  { name: '1981', color: '#FDE68A' },
  { name: 'La Barra', color: '#BAC9FF' },
  { name: 'La Bodega', color: '#C4B5FD' },
  { name: 'Sugerencias', color: '#A7F3D0' },
];

// ─── Fotos de la mediateca del cliente ────────────────────────────────────────
//
// Metadatos reales (`get_file` de la MCP): extensión del original, medidas y el
// asunto que describe la propia mediateca. El asunto importa: por el nombre de
// fichero yo había clasificado `jota-ele-012` o `rest-jota-ele-078` como planos
// de sala, y son PLATOS. Con el título de la mediateca delante, la asignación
// deja de ser adivinanza.
//
// LO QUE FALTA, Y ES MUCHO: de 21 imágenes, solo DOS son interiores
// (fondo_restaurante y rest-jota-ele-100). No hay ni una foto de la bodega, ni
// de botellas, ni de la barra en servicio, ni del equipo. Las series 1981, La
// Barra y La Bodega —las tres que pidió el cliente— se apoyan por tanto en dos
// panorámicas repetidas. Es el encargo de producción número uno.
const FOTO = {
  // Interiores (los únicos)
  interior: { id: '472c753c-911e-4073-a592-1d89d20cccd6', ext: 'jpg', name: 'fondo_restaurante.jpg', w: 2000, h: 869, familia: 'interior' },
  interior2: { id: 'c880b2c6-8077-494f-976c-24a65f1633ec', ext: 'jpg', name: 'rest-jota-ele-100-murcia-copia.jpg', w: 2000, h: 869, familia: 'interior' },
  // Salado
  atun: { id: '44adf955-c378-4147-8313-ae81f40639ce', ext: 'webp', name: 'restaurante_jotaele_plato_1-1.webp', w: 2000, h: 1153, familia: 'salado' },
  queso: { id: '013492eb-4991-4492-835c-381117df72db', ext: 'webp', name: 'restaurante_jotaele_plato_2.webp', w: 2000, h: 1134, familia: 'salado' },
  tartar: { id: '4ebe9252-9ebb-4d1c-80d5-d48031fc958b', ext: 'webp', name: 'restaurante_jotaele_plato_4.webp', w: 2000, h: 1134, familia: 'salado' },
  altaCocina: { id: '1ac681bd-faea-4273-8e27-16c4ee3f54f2', ext: 'webp', name: 'restaurante_jotaele_plato_6.webp', w: 2000, h: 1134, familia: 'salado' },
  sofrito: { id: '9e3db17c-ece7-42fb-8c0e-8c707a9c2abf', ext: 'webp', name: 'restaurante_jotaele_plato_7.webp', w: 2000, h: 1134, familia: 'salado' },
  alcachofas: { id: '8a84c7d9-830c-4763-8b24-94e0e459cc83', ext: 'webp', name: 'restaurante_jotaele_plato_9.webp', w: 2000, h: 1134, familia: 'salado' },
  pulpo: { id: '5f368493-0ab8-4e03-8404-b4acb2bdd45d', ext: 'webp', name: 'restaurante_jotaele_plato_11.webp', w: 2000, h: 1134, familia: 'salado' },
  fresco: { id: '258aaba1-e1e1-4235-82d5-63bf51d79509', ext: 'webp', name: 'restaurante_jotaele_plato_12.webp', w: 2000, h: 1134, familia: 'salado' },
  estofado: { id: 'f06fd87e-e881-456e-9eef-4112155462fd', ext: 'jpg', name: 'jota-ele-012-murcia-med-j-zamora-copia.jpg', w: 2000, h: 1333, familia: 'salado' },
  ensalada: { id: '025cfa0e-b35c-47ad-84c2-30959c36cbff', ext: 'webp', name: 'rest-jota-ele-078-murcia-copia.webp', w: 2000, h: 1335, familia: 'salado' },
  bocado: { id: 'a8ecf18a-a20e-4f6d-a222-823687ac0c66', ext: 'webp', name: 'jota-ele-055-murcia-med-j-zamora-copia.webp', w: 2000, h: 1333, familia: 'salado' },
  vertical1: { id: '0e9a3140-6dc9-4279-acf5-f2527baef3e6', ext: 'jpg', name: 'P1043898.JPG', w: 4336, h: 5776, familia: 'salado' },
  vertical2: { id: '1869837f-e6d2-4c5e-b826-e596d69a8792', ext: 'jpg', name: 'P1043917.JPG', w: 4336, h: 5776, familia: 'salado' },
  vertical3: { id: '40462337-9797-4da2-9722-3916f77ffa40', ext: 'jpg', name: 'P1043919.JPG', w: 4336, h: 5776, familia: 'salado' },
  // Dulce
  cremaCatalana: { id: 'acf17ab4-a0fd-4210-8d4f-b66d52912252', ext: 'webp', name: 'restaurante_jotaele_plato_14.webp', w: 2000, h: 1134, familia: 'dulce' },
  islaFlotante: { id: '59e0946f-c5ac-422c-815e-9f801881d897', ext: 'webp', name: 'restaurante_jotaele_plato_16.webp', w: 2000, h: 1134, familia: 'dulce' },
  flan: { id: '3fc8b001-7931-43fb-bd47-bffcdd76c052', ext: 'webp', name: 'restaurante_jotaele_plato_17.webp', w: 2000, h: 1134, familia: 'dulce' },
  cremaCatalana2: { id: '73ddd876-bdde-4811-b1d1-3f03b2d947ce', ext: 'webp', name: 'jota-ele-126-murcia-med-j-zamora-copia.webp', w: 2000, h: 1333, familia: 'dulce' },
  bizcocho: { id: 'aa03b61b-fb7c-49e5-9e4c-445a8cd95172', ext: 'jpg', name: 'P1043931.JPG', w: 4336, h: 5776, familia: 'dulce' },
} as const;

type ClaveFoto = keyof typeof FOTO;

// ─── El calendario ────────────────────────────────────────────────────────────

interface Pieza0 {
  /** Fecha que se VE en el calendario. */
  dia: string;
  tipo: 'image' | 'story' | 'reel';
  serie: string;
  arq: Arquetipo;
  copy: string;
  img?: ClaveFoto;
  /** Opciones parecidas que se dejan FUERA de la página para comparar. */
  alts?: ClaveFoto[];
  titular?: string;
  cuerpo?: string[];
  kicker?: string;
  cta?: string;
}

const CALENDARIO: Pieza0[] = [
  // ── SEPTIEMBRE: 12 piezas (6 story · 4 image · 2 reel) ─────────────────────
  {
    dia: '2026-09-01', tipo: 'image', serie: '1981', arq: 'fotoTitular', img: 'interior',
    kicker: 'Desde 1981',
    titular: 'Cuarenta y cinco años en la misma plaza.',
    cuerpo: ['Da tiempo a cambiar muchas veces la carta y ninguna la manera de hacer las cosas.'],
    copy: 'Cuarenta y cinco años en la misma plaza.\n\nDesde 1981 en la Plaza de Santa Isabel. Da tiempo a cambiar muchas veces la carta y ninguna la manera de hacer las cosas.\n\n#JotaEle #Murcia',
    alts: ['interior2', 'estofado', 'altaCocina'],
  },
  {
    dia: '2026-09-03', tipo: 'story', serie: 'Sugerencias', arq: 'fotoLimpia', img: 'atun',
    kicker: 'Sugerencias',
    copy: 'BRIEF: pizarra o carta de sugerencias del día. Foto limpia, sin texto comercial encima.',
    alts: ['pulpo', 'fresco', 'tartar'],
  },
  {
    dia: '2026-09-05', tipo: 'reel', serie: 'La Barra', arq: 'fotoTitular', img: 'interior2',
    kicker: 'La Barra',
    titular: 'La misma cocina, de pie.',
    cuerpo: ['Lo que sale al comedor sale también a la barra. Sin mantel y sin esperar mesa.'],
    copy: 'La misma cocina, de pie.\n\nLo que sale al comedor sale también a la barra. Sin mantel y sin esperar mesa.\n\nBRIEF grabación: manos en el pase, plato saliendo, barra con gente. 15-20 s.',
    alts: ['interior', 'vertical1', 'queso'],
  },
  {
    dia: '2026-09-08', tipo: 'image', serie: 'Sugerencias', arq: 'fotoTitular', img: 'alcachofas',
    kicker: 'Sugerencias',
    titular: 'Alcachofas naturales con jamón ibérico.',
    cuerpo: ['Naturales. Ahí empieza y ahí acaba la receta.'],
    copy: 'Alcachofas naturales con jamón ibérico.\n\nNaturales. Ahí empieza y ahí acaba la receta.\n\n#JotaEle #Murcia',
    alts: ['ensalada', 'atun', 'queso'],
  },
  {
    dia: '2026-09-10', tipo: 'story', serie: 'La Bodega', arq: 'ctaStory', img: 'interior2',
    kicker: 'La Bodega', cta: 'LA BOTELLA', titular: 'Referencia de la semana',
    copy: 'BRIEF: botella de la semana. [Elegir referencia de la carta.] Foto de la etiqueta y una línea de por qué está en la casa. PENDIENTE: no hay fotos de bodega en la mediateca.',
    alts: ['interior', 'bocado', 'queso'],
  },
  {
    dia: '2026-09-12', tipo: 'story', serie: 'La Barra', arq: 'fotoLimpia', img: 'interior',
    kicker: 'La Barra',
    copy: 'BRIEF: la barra al mediodía. Plano corto del pase. [Confirmar horario de barra antes de publicar.]',
    alts: ['interior2', 'vertical2', 'sofrito'],
  },
  {
    dia: '2026-09-15', tipo: 'image', serie: 'La Bodega', arq: 'editorial',
    kicker: 'La Bodega',
    titular: 'Krug. Cristal. Recaredo. Valdespino.',
    cuerpo: ['No es la carta de vinos que se espera de una casa de barrio.', 'Es exactamente la que hay en la Plaza de Santa Isabel.'],
    copy: 'Krug. Cristal. Recaredo. Valdespino.\n\nNo es la carta de vinos que se espera de una casa de barrio. Es exactamente la que hay en la Plaza de Santa Isabel.\n\n#JotaEle #Murcia #Vino',
  },
  {
    dia: '2026-09-17', tipo: 'story', serie: 'La Barra', arq: 'ctaStory', img: 'interior2',
    kicker: 'Sin mantel', cta: 'LA BARRA', titular: 'Se come igual que en el comedor',
    copy: 'BRIEF: la barra como alternativa al comedor. La web ya lo dice: una gran barra en la que degustar la misma propuesta. [Confirmar si se puede reservar barra o es solo por orden de llegada.]',
    alts: ['interior', 'vertical1', 'altaCocina'],
  },
  {
    dia: '2026-09-19', tipo: 'reel', serie: 'Sugerencias', arq: 'fotoTitular', img: 'sofrito',
    kicker: 'Sugerencias',
    titular: 'Buñuelos de bacalao de anzuelo.',
    cuerpo: ['De anzuelo, no de red. La diferencia se nota antes de masticar.'],
    copy: 'Buñuelos de bacalao de anzuelo.\n\nDe anzuelo, no de red. La diferencia se nota antes de masticar.\n\nBRIEF grabación: masa, fritura y plato terminado. 15 s, sin música alta.',
    alts: ['altaCocina', 'vertical2', 'estofado'],
  },
  {
    dia: '2026-09-22', tipo: 'story', serie: '1981', arq: 'ctaStory', img: 'interior',
    kicker: '1981', cta: '¿TE ACUERDAS?', titular: 'Cuéntanoslo en respuestas',
    copy: 'BRIEF: foto de archivo del local o de la plaza. Pedir recuerdos en respuestas. [Buscar material antiguo con la familia.]',
    alts: ['interior2', 'cremaCatalana2', 'bizcocho'],
  },
  {
    dia: '2026-09-24', tipo: 'image', serie: '1981', arq: 'fotoTitular', img: 'interior2',
    kicker: '1981',
    titular: 'Francisco lleva aquí desde 1986.',
    cuerpo: ['Entró con la casa ya abierta y acabó dándole su propio estilo de cocina.'],
    copy: 'Francisco lleva aquí desde 1986.\n\nEntró con la casa ya abierta y acabó dándole su propio estilo de cocina.\n\n#JotaEle #Murcia',
    alts: ['interior', 'estofado', 'vertical3'],
  },
  {
    dia: '2026-09-28', tipo: 'story', serie: 'Sugerencias', arq: 'ctaStory', img: 'fresco',
    kicker: 'Sugerencias', cta: 'CAMBIA LA CARTA', titular: 'Entra el otoño',
    copy: 'BRIEF: aviso de cambio de temporada en sugerencias. [Confirmar qué entra.]',
    alts: ['tartar', 'pulpo', 'atun'],
  },

  // ── OCTUBRE: 14 piezas (7 story · 5 image · 2 reel) ────────────────────────
  {
    dia: '2026-10-01', tipo: 'image', serie: 'Sugerencias', arq: 'fotoTitular', img: 'sofrito',
    kicker: 'Octubre',
    titular: 'Octubre entra en la carta.',
    cuerpo: ['Cambia el producto y con él media carta de sugerencias.'],
    copy: 'Octubre entra en la carta.\n\nCambia el producto y con él media carta de sugerencias.\n\n#JotaEle #Murcia',
    alts: ['estofado', 'altaCocina', 'vertical3'],
  },
  {
    dia: '2026-10-02', tipo: 'story', serie: 'La Bodega', arq: 'ctaStory', img: 'interior',
    kicker: 'La Bodega', cta: 'GENEROSOS', titular: 'Amontillado Coliseo, de Valdespino',
    copy: 'BRIEF: los generosos de la casa. Foto de la copa a contraluz. PENDIENTE de foto de bodega propia.',
    alts: ['interior2', 'bocado', 'queso'],
  },
  {
    dia: '2026-10-04', tipo: 'reel', serie: 'La Bodega', arq: 'editorial',
    kicker: 'La Bodega',
    titular: 'Una bodega que no se espera.',
    cuerpo: ['Krug Clos du Mesnil. Roederer Cristal. Recaredo Turó d’en Mota.', 'La Barajuela. Encrucijado. En la Plaza de Santa Isabel.'],
    copy: 'Una bodega que no se espera.\n\nKrug Clos du Mesnil. Roederer Cristal. Recaredo Turó d’en Mota. La Barajuela. Encrucijado.\n\nEn la Plaza de Santa Isabel, desde 1981.\n\nBRIEF grabación: recorrido por las botellas, plano corto de etiquetas. PRIORITARIO: hace falta rodar la bodega, no hay material.',
  },
  {
    dia: '2026-10-06', tipo: 'story', serie: 'La Barra', arq: 'fotoLimpia', img: 'interior2',
    kicker: 'La Barra',
    copy: 'BRIEF: la barra antes del servicio. Plano quieto, sin gente.',
    alts: ['interior', 'vertical2', 'altaCocina'],
  },
  {
    dia: '2026-10-08', tipo: 'image', serie: 'Sugerencias', arq: 'fotoTitular', img: 'estofado',
    kicker: 'Sugerencias',
    titular: 'Alubias con bogavante.',
    cuerpo: ['Un guiso de cuchara que no pide permiso para llevar bogavante.'],
    copy: 'Alubias con bogavante.\n\nUn guiso de cuchara que no pide permiso para llevar bogavante.\n\n#JotaEle #Murcia',
    alts: ['altaCocina', 'vertical3', 'sofrito'],
  },
  {
    dia: '2026-10-10', tipo: 'story', serie: 'Sugerencias', arq: 'ctaStory', img: 'queso',
    kicker: 'Puente del Pilar', cta: 'RESERVA', titular: '968 220 730',
    copy: 'BRIEF: puente del Pilar. [Confirmar horarios de esos días.] Recordatorio de reserva por teléfono.',
    alts: ['atun', 'tartar', 'pulpo'],
  },
  {
    dia: '2026-10-13', tipo: 'image', serie: '1981', arq: 'fotoTitular', img: 'interior',
    kicker: '1981',
    titular: 'La misma plaza, cuarenta y cinco octubres.',
    cuerpo: ['Plaza de Santa Isabel, 6. Murcia.'],
    copy: 'La misma plaza, cuarenta y cinco octubres.\n\nPlaza de Santa Isabel, 6. Murcia.\n\n#JotaEle #Murcia',
    alts: ['interior2', 'cremaCatalana', 'flan'],
  },
  {
    dia: '2026-10-15', tipo: 'story', serie: 'La Bodega', arq: 'ctaStory', img: 'interior2',
    kicker: 'La Bodega', cta: 'ESPUMOSOS', titular: 'Recaredo y Raventós i Blanc',
    copy: 'BRIEF: los espumosos de la casa. [Elegir uno y decir por qué está en la carta.] PENDIENTE de foto de bodega propia.',
    alts: ['interior', 'bocado', 'bizcocho'],
  },
  {
    dia: '2026-10-17', tipo: 'reel', serie: 'La Barra', arq: 'fotoTitular', img: 'interior',
    kicker: 'La Barra',
    titular: 'Cinco minutos en la barra.',
    cuerpo: ['A un metro de la cocina, que es la mejor mesa de la casa.'],
    copy: 'Cinco minutos en la barra.\n\nA un metro de la cocina, que es la mejor mesa de la casa.\n\nBRIEF grabación: plano fijo de la barra en servicio, sonido ambiente.',
    alts: ['interior2', 'vertical1', 'vertical2'],
  },
  {
    dia: '2026-10-20', tipo: 'story', serie: 'La Bodega', arq: 'ctaStory', img: 'interior2',
    kicker: 'La Bodega', cta: 'POR COPAS', titular: 'Lo que hay abierto esta semana',
    copy: 'BRIEF: qué se sirve por copas. [Listar tres referencias.]',
    alts: ['interior', 'queso', 'bocado'],
  },
  {
    dia: '2026-10-22', tipo: 'image', serie: 'Sugerencias', arq: 'fotoTitular', img: 'estofado',
    kicker: 'Sugerencias',
    titular: 'Paletilla de cabrito lechal al horno.',
    cuerpo: ['Horno y tiempo. No hay más técnica que esa.'],
    copy: 'Paletilla de cabrito lechal al horno.\n\nHorno y tiempo. No hay más técnica que esa.\n\n#JotaEle #Murcia',
    alts: ['vertical3', 'altaCocina', 'sofrito'],
  },
  {
    dia: '2026-10-24', tipo: 'story', serie: 'La Barra', arq: 'fotoLimpia', img: 'interior',
    kicker: 'Sábado de barra',
    copy: 'BRIEF: ambiente de sábado en la barra. Sin texto encima.',
    alts: ['interior2', 'vertical1', 'fresco'],
  },
  {
    dia: '2026-10-27', tipo: 'image', serie: '1981', arq: 'editorial',
    kicker: 'Desde 1981',
    titular: 'Calidad, tradición y evolución.',
    cuerpo: ['Es lo que pone en la puerta desde hace cuarenta y cinco años.', 'Plaza de Santa Isabel, 6. Murcia.'],
    copy: 'Calidad, tradición y evolución.\n\nEs lo que pone en la puerta desde hace cuarenta y cinco años.\n\nPlaza de Santa Isabel, 6. Murcia.\n\n#JotaEle #Murcia',
  },
  {
    dia: '2026-10-29', tipo: 'story', serie: '1981', arq: 'ctaStory', img: 'islaFlotante',
    kicker: 'Cierre de octubre', cta: 'NOVIEMBRE', titular: 'Y fechas de Navidad',
    copy: 'BRIEF: cierre de mes, disponibilidad de noviembre y aviso de reservas de Navidad. [Confirmar fechas.]',
    alts: ['flan', 'cremaCatalana', 'bizcocho'],
  },
];

// ─── Fecha almacenada ─────────────────────────────────────────────────────────
//
// `timeupload` guarda la MEDIANOCHE LOCAL en UTC, así que la fila lleva el día
// ANTERIOR al que se ve. Y el desfase cambia con el horario de verano: en 2026
// el cambio es el 25 de octubre, de 22:00Z a 23:00Z.
function almacenada(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const previo = d.toISOString().slice(0, 10);
  const invierno = dia > '2026-10-25';
  return `${previo}T${invierno ? '23' : '22'}:00:00.000Z`;
}

// ─── Emisión ──────────────────────────────────────────────────────────────────

const q = (s: unknown) =>
  s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
const comentario = (s: unknown) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 68);

const workflow = {
  states: [
    { id: 'je-borrador', name: 'Borrador', color: '#BAC9FF', order: 0, description: '', actions: [] },
    { id: 'je-revision', name: 'En revisión', color: '#F43F5E', order: 1, description: '', actions: [] },
    { id: 'je-aprobado', name: 'Aprobado', color: '#FDE68A', order: 2, description: '', actions: [] },
    { id: 'je-publicado', name: 'Programado/Publicado', color: '#FCA5A5', order: 3, description: '', actions: [] },
  ],
  transitions: {
    Borrador: ['En revisión'],
    'En revisión': ['Aprobado'],
    Aprobado: ['Programado/Publicado'],
    'Programado/Publicado': [],
  },
};

const sql: string[] = [
  '-- Jota Ele: series, etiquetas y calendario de arranque (sept + oct 2026).',
  `-- ${NOW}. Solo toca el proyecto ${PROYECTO} del espacio ${SANDBOX}.`,
  '',
  '-- 1. Mediateca del cliente, workflow y series.',
  `UPDATE projects SET mediaProjectId=${q(MM)}, workflow=${q(JSON.stringify(workflow))}, ` +
    `workflowTags=${q(JSON.stringify(SERIES))}, ` +
    `defaultContentTypes=${q(JSON.stringify(['image', 'story', 'reel']))}, ` +
    `updatedAt=${q(NOW)} WHERE id=${q(PROYECTO)} AND spaceId=${q(SANDBOX)};`,
];
const rollback: string[] = [
  `UPDATE projects SET mediaProjectId=NULL, workflow=NULL, workflowTags=NULL, defaultContentTypes=NULL WHERE id=${q(PROYECTO)};`,
  `DELETE FROM designs WHERE projectId=${q(PROYECTO)} AND spaceId=${q(SANDBOX)};`,
  `DELETE FROM content WHERE project=${q(PROYECTO)};`,
];
const informe: Array<Record<string, unknown>> = [];

sql.push('', '-- 2. Contenidos y sus diseños.');

for (const p of CALENDARIO) {
  const esVertical = p.tipo !== 'image';
  const W = 1080;
  const H = esVertical ? 1920 : 1350;
  const frameId = nid();
  const files: Record<string, unknown> = {};
  const ctx: Ctx = {
    W, H, m: JOTAELE, frameId, files,
    pad: 84,
    safeTop: esVertical ? 250 : 70,
    safeBottom: esVertical ? 300 : 80,
  };

  const pieza: Pieza = {
    titular: p.titular ?? '',
    cuerpo: p.cuerpo ?? [],
    kicker: p.kicker,
    cta: p.cta,
    img: p.img ? FOTO[p.img] : undefined,
  };

  const elementos: El[] = [
    base({ id: frameId, type: 'frame', x: 0, y: 0, width: W, height: H, name: `${p.dia} · ${p.tipo}`, strokeColor: '#bbb' }),
    base({
      id: nid(), type: 'rectangle', x: 0, y: 0, width: W, height: H,
      backgroundColor: JOTAELE.fondo, fillStyle: 'solid', strokeColor: '#d4d4d8', strokeWidth: 1,
      locked: true, frameId, customData: { c2: 'pageBackground' },
    }),
    ...ARQUETIPOS[p.arq](ctx, pieza),
    // Fuera del marco, encima: material de repuesto a un arrastre de distancia.
    ...alternativas((p.alts ?? []).map((k) => FOTO[k]), MM, W, files, JOTAELE),
  ];

  const escena = JSON.stringify({
    elements: elementos,
    appState: { viewBackgroundColor: '#f5f5f5' },
    files,
    fonts: carasDe(JOTAELE),
  });

  const contentId = randomUUID();
  const designId = randomUUID();
  const cuando = almacenada(p.dia);

  sql.push('', `-- ${p.dia} [${p.tipo}] ${p.serie} · ${p.arq} :: ${comentario(p.titular ?? p.copy)}`);
  sql.push(
    'INSERT INTO designs (id, name, editorConfig, pages, createdBy, projectId, spaceId, template, "desc", format, createdAt, updatedAt) VALUES (' +
      `${q(designId)}, ${q(`${p.dia} · ${p.serie}`)}, ${q(escena)}, 1, ${q(OWNER)}, ${q(PROYECTO)}, ` +
      `${q(SANDBOX)}, 0, ${q('canvas2 · calendario de arranque Jota Ele')}, 'excalidraw', ${q(NOW)}, ${q(NOW)});`,
  );
  sql.push(
    'INSERT INTO content (id, contentid, project, typecontent, status, copy, timeupload, pages, designId, tags, createdAt, updatedAt) VALUES (' +
      `${q(contentId)}, ${q(contentId)}, ${q(PROYECTO)}, ${q(p.tipo)}, 'Borrador', ${q(p.copy)}, ` +
      `${q(cuando)}, 1, ${q(designId)}, ${q(JSON.stringify([p.serie]))}, ${q(NOW)}, ${q(NOW)});`,
  );

  informe.push({
    dia: p.dia, mes: p.dia.slice(0, 7), tipo: p.tipo, serie: p.serie, arquetipo: p.arq,
    conFoto: !!p.img, foto: p.img ?? null, esBrief: p.copy.startsWith('BRIEF'),
    contentId, designId, bytes: escena.length,
  });
}

const SALIDA = path.join(DIR, 'jotaele-calendario');
writeFileSync(`${SALIDA}.sql`, sql.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.rollback.sql`, rollback.join('\n') + '\n', 'utf8');
writeFileSync(`${SALIDA}.informe.json`, JSON.stringify(informe, null, 1), 'utf8');

const cuenta = (k: string, v: string) => informe.filter((e) => e[k] === v).length;
console.log('piezas:', informe.length);
console.log('  septiembre:', cuenta('mes', '2026-09'), '· octubre:', cuenta('mes', '2026-10'));
console.log('  story:', cuenta('tipo', 'story'), '· image:', cuenta('tipo', 'image'), '· reel:', cuenta('tipo', 'reel'));
for (const s of SERIES) console.log(`  ${s.name.padEnd(16)} ${cuenta('serie', s.name)}`);
console.log('con foto:', informe.filter((e) => e.conFoto).length, '· briefs a completar:', informe.filter((e) => e.esBrief).length);
console.log('mayor sentencia:', Math.max(...sql.map((l) => l.length)), 'bytes');
console.log(`\nsql: ${SALIDA}.sql`);
