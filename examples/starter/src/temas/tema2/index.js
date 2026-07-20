/* Manifiesto del Tema 2 de la demo · Órbitas y leyes de Kepler.
   Escrito siguiendo ÚNICAMENTE docs/SKILL-crear-tema.md, para validar que el
   contrato del skill basta para producir un tema completo y funcional. */
import { renderCardTreesInto } from 'apuntes-sdk';

/* --- §4 engine: contenido citable --- */
const SECTIONS = {
  kepler1: { title: 'Primera ley (órbitas)', apartados: [
    { n: 1, text: 'Los planetas describen órbitas elípticas con el Sol en uno de los focos.' },
    { n: 2, text: 'La excentricidad mide cuánto se aparta la elipse de una circunferencia.' }
  ] },
  kepler2: { title: 'Segunda ley (áreas)', apartados: [
    { n: 1, text: 'La línea que une un planeta con el Sol barre áreas iguales en tiempos iguales.' },
    { n: 2, text: 'Por eso el planeta va más rápido en el perihelio y más lento en el afelio.' }
  ] },
  kepler3: { title: 'Tercera ley (períodos)', text: 'El cuadrado del período orbital es proporcional al cubo del semieje mayor: T² ∝ a³. Si el semieje se mide en UA y el período en años, la constante vale 1.' },
  gravitacion: { title: 'Gravitación universal', text: 'Dos cuerpos se atraen con una fuerza proporcional al producto de sus masas e inversamente proporcional al cuadrado de la distancia.' }
};

const SOURCE = {
  kepler1: { title: 'Primera ley', paragraphs: [
    { n: 1, text: 'Todos los planetas se desplazan alrededor del Sol describiendo órbitas elípticas, estando el Sol situado en uno de los focos.' },
    { n: 2, text: 'La excentricidad e de una elipse cumple 0 ≤ e < 1; para e = 0 la elipse es una circunferencia.' }
  ] },
  kepler2: { title: 'Segunda ley', paragraphs: [
    { n: 1, text: 'El radio vector que une un planeta y el Sol barre áreas iguales en tiempos iguales.' },
    { n: 2, text: 'La velocidad areolar es constante, de donde se sigue la conservación del momento angular.' }
  ] },
  kepler3: { title: 'Tercera ley', paragraphs: [
    { n: null, text: 'Para cualquier planeta, el cuadrado de su período orbital es directamente proporcional al cubo de la longitud del semieje mayor de su órbita.' }
  ] }
};

const engine = {
  sections: SECTIONS,
  source: SOURCE,
  labelFor: (k) => (SECTIONS[k] ? SECTIONS[k].title : k),
  keySplit: 'first',
  specialTags: {}
};

/* --- §3.3 tarjetas (datos; el helper pone el DOM y el data-mark-id) --- */
const svg = (inner) => '<svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';

const CARDS_LEYES = [
  { sig: '1.1', name: 'Primera ley · órbitas elípticas', artNums: ['kepler1'],
    desc: 'Las órbitas son <b>elipses</b>, no círculos, con el Sol en un foco.',
    truco: 'El Sol NO está en el centro: está en un foco',
    illus: svg('<ellipse cx="30" cy="30" rx="22" ry="14" stroke="#3f8fd0" stroke-width="2"/><circle cx="16" cy="30" r="4" fill="#e8a13a"/>') },
  { sig: '1.2', name: 'Segunda ley · áreas iguales', artNums: ['kepler2'],
    desc: 'El radio vector barre <b>áreas iguales</b> en tiempos iguales.',
    truco: 'Cerca del Sol corre más; lejos, más lento',
    illus: svg('<circle cx="14" cy="30" r="4" fill="#e8a13a"/><path d="M14 30 L44 18 L44 42 Z" fill="#3f8fd0" opacity=".35"/>') },
  { sig: '1.3', name: 'Tercera ley · T² ∝ a³', artNums: ['kepler3'],
    desc: 'Relaciona el <b>período</b> con el tamaño de la órbita, medido en UA.',
    truco: 'T al cuadrado, a al cubo',
    illus: svg('<circle cx="30" cy="30" r="6" fill="#e8a13a"/><circle cx="30" cy="30" r="13" stroke="#3f8fd0" stroke-width="1.5"/><circle cx="30" cy="30" r="22" stroke="#3f8fd0" stroke-width="1.5"/>') }
];

const CARDS_CAUSA = [
  { sig: '2.1', name: 'Gravitación universal', artNums: ['gravitacion'],
    desc: 'La ley de <b>Newton</b> explica por qué se cumplen las de Kepler.',
    truco: 'Fuerza ∝ masas / distancia²',
    illus: svg('<circle cx="18" cy="30" r="9" fill="#e8a13a"/><circle cx="44" cy="30" r="5" fill="#3f8fd0"/><path d="M28 30h10" stroke="#8b8475" stroke-width="2" stroke-dasharray="3 3"/>') }
];

/* --- §3.1/§3.2 plantilla: apartado + bandas CON id + contenedores --- */
const TEMPLATE = `
  <div class="apartado-head reveal" id="ap-kepler">
    <span class="apn">Apartado 1</span>
    <h2>Las leyes de Kepler</h2>
    <p class="apsub">Cómo se mueven los planetas: la descripción cinemática.</p>
  </div>

  <div class="band b-orbita reveal" id="leyes">
    <div class="rom">1</div>
    <div>
      <div class="k">Cómo se mueven</div>
      <h2>Las tres leyes</h2>
      <div class="sub">Órbitas elípticas, velocidad variable y relación período-tamaño.</div>
    </div>
  </div>
  <div class="tree" id="tree-leyes"></div>

  <div class="band b-orbita reveal" id="causa">
    <div class="rom">2</div>
    <div>
      <div class="k">Por qué se mueven así</div>
      <h2>La causa: la gravitación</h2>
      <div class="sub">Newton demuestra que las leyes de Kepler se deducen de la gravitación.</div>
    </div>
  </div>
  <div class="tree" id="tree-causa"></div>`;

/* --- §7 examen --- */
const questions = [
  { id: 1, bloque: 'Órbitas', articulo: 'kepler1.1',
    pregunta: 'Según la primera ley de Kepler, ¿qué forma tienen las órbitas planetarias?',
    respuestas: ['Circunferencias perfectas', 'Elipses con el Sol en un foco', 'Parábolas', 'Espirales'],
    correcta: 'Elipses con el Sol en un foco',
    explicacion: 'Las órbitas son elípticas y el Sol ocupa uno de los dos focos, no el centro.' },
  { id: 2, bloque: 'Órbitas', articulo: 'kepler2.2',
    pregunta: '¿Dónde se mueve más rápido un planeta en su órbita?',
    respuestas: ['En el afelio', 'En el perihelio', 'A velocidad constante', 'En los nodos'],
    correcta: 'En el perihelio',
    explicacion: 'Al barrer áreas iguales en tiempos iguales, cerca del Sol (perihelio) la velocidad es mayor.' },
  { id: 3, bloque: 'Órbitas', articulo: 'kepler3',
    pregunta: '¿Qué relación establece la tercera ley de Kepler?',
    respuestas: ['T ∝ a', 'T² ∝ a³', 'T³ ∝ a²', 'T ∝ 1/a'],
    correcta: 'T² ∝ a³',
    explicacion: 'El cuadrado del período es proporcional al cubo del semieje mayor.' },
  { id: 4, bloque: 'Órbitas', articulo: 'gravitacion',
    pregunta: 'En la ley de gravitación universal, la fuerza es inversamente proporcional a…',
    respuestas: ['La distancia', 'El cuadrado de la distancia', 'El cubo de la distancia', 'La masa'],
    correcta: 'El cuadrado de la distancia',
    explicacion: 'F = G·m₁·m₂/d²: la fuerza decae con el cuadrado de la distancia.' }
];

/* --- §8 minijuegos (flashcards salen de engine.sections sin configurar) --- */
const games = [
  { id: 'flash-kepler', ico: '🃏', title: 'Flashcards', desc: 'Repasa las leyes una a una.',
    start: (api) => api.startFlashcards() }
];

export default {
  id: 'tema2',
  numeral: '◐',
  k: 'Demo · Órbitas y Kepler',
  titulo: 'Órbitas y leyes de Kepler',
  descripcion: 'Las tres leyes de Kepler y la gravitación universal que las explica.',
  accent: 'var(--orbita)',
  headerHtml: `<p class="eyebrow">Demo · SDK de apuntes</p>
    <h1>Órbitas y <em>leyes de Kepler</em></h1>
    <p class="lede">Cómo se mueven los planetas y por qué: de la descripción de Kepler a la causa de Newton.</p>`,
  chips: [
    { cls: 'a-orbita', anchor: 'leyes', label: 'Las tres leyes' },
    { cls: 'a-orbita', anchor: 'causa', label: 'Gravitación' }
  ],
  engine,
  renderContent(el){
    el.innerHTML = TEMPLATE;
    renderCardTreesInto(el, engine, [
      { containerId: 'tree-leyes', cards: CARDS_LEYES, cls: 'a-orbita' },
      { containerId: 'tree-causa', cards: CARDS_CAUSA, cls: 'a-orbita' }
    ]);
  },
  games,
  questions,
  glossary: { UA: 'Unidad Astronómica' },   // ≥2 letras y debe aparecer en la prosa
  bloques: ['Órbitas']
};
