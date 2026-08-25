#!/usr/bin/env node
/* `apuntes-verify` — comprueba que los temas de una app cumplen el contrato del
   SDK ANTES de que falle en manos del usuario.

   Cada comprobación existe porque el fallo correspondiente ocurrió de verdad:
   - ids duplicados            → un deep-link aterrizaba en la tarjeta equivocada
   - .card sin data-mark-id    → invisible para buscador, plan de estudio y marcador
   - dos tarjetas con la misma clave → marcar una marcaba la otra
   - una clave que desaparece  → renombrar una tarjeta dejaba huérfana la marca
                                 del usuario, sin ningún síntoma visible
   - tarjeta sin .name/.label  → el indexador se la saltaba: el tema no salía al buscar
   - .disclosure dentro de .det→ el botón quedaba recortado e inpulsable
   - APIs de navegador al importar → rompía los scripts de línea de comandos
   - glosario con claves <2 letras o ausentes del texto → se ignoraban en silencio

   Uso:  apuntes-verify [ruta/al/registry.js]     (por defecto ./src/registry.js) */

import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, extname, relative } from 'node:path';

const RESET = '\x1b[0m', RED = '\x1b[31m', YEL = '\x1b[33m', GRN = '\x1b[32m', DIM = '\x1b[2m', B = '\x1b[1m';

const registryPath = resolve(process.argv[2] || 'src/registry.js');
if(!existsSync(registryPath)){
  console.error(`${RED}✗ No encuentro el registro de temas en${RESET} ${registryPath}\n` +
    `  Pásame la ruta:  apuntes-verify ruta/al/registry.js`);
  process.exit(2);
}
const registryUrl = pathToFileURL(registryPath).href;

/* ---------- hallazgos ---------- */
const findings = [];   // {tema, level:'error'|'warn', code, msg, hint}
const glosarioGlobal = new Map();   // clave -> ¿aparece en algún tema?
const clavesPorTema = new Map();    // temaId -> [claves de marca] (inventario versionado)
/* Determinantes: si al quitar el sufijo solo queda uno de estos, el nombre del
   apartado ES la respuesta (no hay contaminación). */
const ARTICULOS = new Set(['el','la','los','las','un','una','unos','unas','del','de','al','su','sus','este','esta','ese','esa','lo']);
const add = (tema, level, code, msg, hint) => findings.push({ tema, level, code, msg, hint });

/* ---------- PASADA A: importar SIN DOM ----------
   Los scripts de línea de comandos (exportadores, validadores) importan el
   registro en node pelado. Si un módulo toca window/document/localStorage en el
   CUERPO (no dentro de una función), revienta ahí. Se prueba en un proceso
   aparte porque el import se cachea. */
function pasadaSinDom(){
  const r = spawnSync(process.execPath,
    ['--input-type=module', '-e', `await import(${JSON.stringify(registryUrl)});`],
    { encoding: 'utf8' });
  if(r.status === 0) return true;
  const err = (r.stderr || '').trim();
  const cola = err ? DIM + '     ' + err.split('\n').slice(0, 3).join('\n     ') + RESET : '';
  const ref = err.match(/ReferenceError: (\w+) is not defined/);
  const falta = err.match(/Cannot find (?:package|module) '([^']+)'/);

  /* Distinguir la causa: culpar a las APIs de navegador cuando en realidad falta
     una dependencia sería un diagnóstico engañoso. */
  if(ref){
    add('(app)', 'error', 'import-sin-dom',
      `Al importar los temas en node falla: \`${ref[1]}\` no existe.`,
      'Se usa una API de navegador en el CUERPO de un módulo. Muévela dentro de una\n' +
      '     función o protégela (`typeof window !== "undefined"`). Si no, los scripts de\n' +
      '     línea de comandos (exportar el banco, validar) no funcionan.\n' + cola);
  } else if(falta){
    add('(app)', 'error', 'dependencia',
      `Falta la dependencia \`${falta[1]}\`.`,
      'Instala las dependencias del proyecto (`npm install`) antes de verificar.\n' + cola);
  } else {
    add('(app)', 'error', 'import', 'Los temas no se pueden importar en node.', cola);
  }
  return false;
}

/* ---------- DOM headless ---------- */
async function montarDom(){
  let linkedom;
  try { linkedom = await import('linkedom'); }
  catch {
    console.error(`${RED}✗ Falta \`linkedom\`${RESET} (el DOM headless que usa verify).\n  Instálalo:  npm i -D linkedom`);
    process.exit(2);
  }
  const { parseHTML } = linkedom;
  const { window, document } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = document;
  globalThis.Node = window.Node;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, '\\$&') };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.localStorage = {
    _d: new Map(),
    getItem(k){ return this._d.has(k) ? this._d.get(k) : null; },
    setItem(k, v){ this._d.set(k, String(v)); },
    removeItem(k){ this._d.delete(k); },
    key(i){ return [...this._d.keys()][i] ?? null; },
    get length(){ return this._d.size; }
  };
  return document;
}

/* ---------- comprobaciones sobre un tema ya renderizado ---------- */
const txt = (el) => (el && el.textContent || '').trim();
/* Muestra un par de ejemplos y resume el resto: mantiene el informe legible
   cuando un mismo fallo se repite decenas de veces. */
const muestra = (arr, n = 2) => arr.length
  ? ': ' + arr.slice(0, n).map(s => `«${s}»`).join(', ') + (arr.length > n ? ` y ${arr.length - n} más` : '')
  : '';

function revisarManifiesto(t, idsVistos){
  const id = t.id;
  for(const campo of ['id', 'titulo', 'k', 'descripcion']){
    if(!t[campo]) add(id || '(sin id)', 'error', 'manifiesto',
      `Falta el campo obligatorio \`${campo}\` en el manifiesto.`,
      'Sin él el tema no se lista bien en el hub, el buscador ni el examen.');
  }
  if(typeof t.renderContent !== 'function')
    add(id || '(sin id)', 'error', 'manifiesto', 'Falta `renderContent(el)` (o no es una función).');
  if(!t.engine) add(id || '(sin id)', 'warn', 'manifiesto',
    'No hay `engine`. Usa el contrato neutro si el tema no tiene texto citable.',
    '`{ sections:{}, source:{}, labelFor: k => k, keySplit: "first" }`');
  if(id){
    if(idsVistos.has(id)) add(id, 'error', 'id-tema', `El id de tema \`${id}\` está repetido.`,
      'Los ids de tema deben ser únicos: van en la URL (#/tema/<id>).');
    idsVistos.add(id);
  }
}

/* Revisa `engine.sections` ANTES de renderizar: aquí se ve la CAUSA de las
   colisiones de ancla, que en el DOM solo se ve como síntoma.
   `anchorId(base, ap)` devuelve el ancla del artículo cuando `ap` es nulo o
   vacío → el apartado hereda el id del artículo y se duplica (además de pintar
   un "null" en pantalla). Lo mismo si dos apartados repiten `n`. */
function revisarEngine(t){
  const id = t.id;
  const secciones = (t.engine && t.engine.sections) || {};
  const nulos = [], repes = [];
  for(const [clave, art] of Object.entries(secciones)){
    if(!art || !Array.isArray(art.apartados)) continue;
    const vistos = new Set();
    for(const ap of art.apartados){
      if(ap.n == null || ap.n === '') nulos.push(clave);
      else if(vistos.has(String(ap.n))) repes.push(`${clave}.${ap.n}`);
      else vistos.add(String(ap.n));
    }
  }
  if(nulos.length) add(id, 'error', 'apartado-sin-n',
    `${nulos.length} apartado(s) con \`n\` nulo o vacío${muestra([...new Set(nulos)])}`,
    'Su ancla sale igual que la del artículo (anchorId ignora un `n` vacío): id\n' +
    '     duplicado y un "null" visible. Dale número al apartado, o si es el encabezado\n' +
    '     del artículo ponlo en `text` en vez de como apartado.');
  if(repes.length) add(id, 'error', 'apartado-n-repetido',
    `${repes.length} apartado(s) con \`n\` repetido dentro de su artículo${muestra(repes)}`,
    'Dos apartados con el mismo número generan la misma ancla.');
}

/* CHROME del SDK: botones que trae la app, no la escena del tema. */
const ES_CHROME = /\b(mark-btn|disclosure|stp-[\w-]+|exam-[\w-]+|acro|search-[\w-]+|sp-[\w-]+|nav-[\w-]+|btn-fav)\b/;

/* La "escena" de una botonera: su tarjeta si la tiene, y si NO la tiene (hay
   reproductores que cuelgan directos del wrap) los ancestros inmediatos, con
   tope para no tragarse la seccion entera y dar por buena una region viva ajena. */
function escenaDe(nodo, box){
  for(let e = nodo; e && e !== box; e = e.parentElement)
    if(e.classList && e.classList.contains('card')) return e;
  let e = nodo, saltos = 0;
  while(e.parentElement && e.parentElement !== box && saltos < 3){ e = e.parentElement; saltos++; }
  return e;
}

function revisarDom(t, box, idsGlobales){
  const id = t.id;

  /* ESCENA MUDA: mando de >=2 controles propios y nada que anuncie el cambio.
     Se busca en TODO el tema, no tarjeta por tarjeta: los reproductores mas
     grandes que encontramos no estaban dentro de ninguna `.card`. Tampoco se
     exige `aria-pressed` — un mando de acciones (play, siguiente) no lo lleva,
     y es justo el caso que se colaba. */
  const mudas = [], vistas = new Set();
  const controles = [...box.querySelectorAll('button, select, [role="button"]')]
    .filter(c => !ES_CHROME.test(c.getAttribute('class') || ''))
    /* `data-ref` es una referencia a un articulo: LLEVA a otro sitio, no reescribe
       nada aqui. Un tema de Legislacion tiene decenas y las conte como escenas las
       dos veces que mire esto a mano. Lo que descarta no es su clase, es que sean
       navegacion: el destino ya se anuncia al aterrizar. */
    .filter(c => !c.hasAttribute('data-ref'));
  const porPadre = new Map();
  for(const c of controles){
    const p = c.parentElement; if(!p) continue;
    if(!porPadre.has(p)) porPadre.set(p, []);
    porPadre.get(p).push(c);
  }
  for(const [padre, grupo] of porPadre){
    if(grupo.length < 2) continue;
    const escena = escenaDe(padre, box);
    if(vistas.has(escena)) continue;
    vistas.add(escena);
    if(escena.querySelector('[aria-live]')) continue;
    const nombre = (escena.querySelector('.name')?.textContent || '').trim()
      || (escena.getAttribute('class') || '').split(' ')[0] || '(sin nombre)';
    mudas.push(nombre.slice(0, 34) + ' ×' + grupo.length);
  }
  if(mudas.length) add(id, 'warn', 'escena-muda',
    `${mudas.length} escena(s) cambian al pulsar sin anunciar el cambio${muestra(mudas)}`,
    'Quien no ve la pantalla oye que ha pulsado un boton y nada mas: el texto que\n' +
    '     cambia al lado no se anuncia. Pon la region viva en el bloque que se reescribe\n' +
    '     ENTERO — `role="status" aria-live="polite"` si se sustituye un valor,\n' +
    '     `role="log"` si se le van añadiendo lineas.');

  /* ids duplicados (dentro del tema y contra el resto de la app) */
  const locales = [...box.querySelectorAll('[id]')].map(e => e.id);
  const dupLocal = [...new Set(locales.filter((v, i) => locales.indexOf(v) !== i))];
  for(const d of dupLocal) add(id, 'error', 'id-duplicado',
    `El id \`${d}\` aparece ${locales.filter(x => x === d).length} veces en este tema.`,
    'getElementById devuelve solo el primero: un deep-link o un marcapáginas al\n' +
    '     segundo aterriza en el equivocado. Suele pasar si dos tarjetas se llaman igual\n' +
    '     y el ancla se deriva del nombre: desambigua uno.');
  /* NO se comprueban colisiones ENTRE temas: la app renderiza un tema cada vez y
     los deep-links llevan el tema (#/tema/<id>/<ancla>), así que dos temas pueden
     reutilizar el mismo ancla sin conflicto (p.ej. `sec-10` en dos leyes). */

  /* `prioridad` con un valor que no existe. El vocabulario es cerrado, así que
     `renderCard` no pinta un valor desconocido — y ahí está el problema: una
     errata da EXACTAMENTE el mismo resultado visible que no declarar nada (sale
     baja) y no deja rastro. Por eso el render marca su propio rechazo con
     `data-prio-invalido` y aquí se caza: es el único modo de fallo que tiene el
     campo, y sin esto es invisible. */
  /* `sig` anuncia un RANGO y el detalle no lo cubre. Promete contenido que no
     esta: la tarjeta dice «Arts. 16-19» y dentro solo van el 16, 17 y 18, asi
     que el 19 se anuncia y no se desarrolla. No falla nada —ni error, ni hueco
     visible— y solo se nota si alguien va a buscar ese articulo concreto.
     Medido antes de añadirlo: 16 tarjetas con rango y detalle en el contenido
     real, 0 con huecos. Una regla que solo salta cuando hay algo que arreglar. */
  const rangosRotos = [];
  for(const c of box.querySelectorAll('.card')){
    const sig = (((c.querySelector('.sig') || {}).textContent) || '').trim();
    const m = sig.match(/(\d+)\s*[-–—]\s*(\d+)\s*$/);
    if(!m) continue;
    const a = +m[1], b = +m[2];
    if(!(b > a) || b - a > 40) continue;
    const nums = new Set([...c.querySelectorAll('[id]')].map(e => {
      const mm = String(e.id).match(/^[A-Za-z]+-(\d+)$/); return mm ? +mm[1] : null;
    }).filter(n => n !== null));
    if(!nums.size) continue;   /* sin detalle: el rango es un rotulo, no una promesa */
    const faltan = [];
    for(let n = a; n <= b; n++) if(!nums.has(n)) faltan.push(n);
    if(faltan.length) rangosRotos.push('"' + sig + '" no desarrolla ' + faltan.join(', '));
  }
  if(rangosRotos.length) add(id, 'warn', 'rango-incompleto',
    `${rangosRotos.length} tarjeta(s) anuncian un rango que no desarrollan${muestra(rangosRotos)}`,
    ['El rotulo promete articulos que la tarjeta no trae. O se añaden a `artNums`,',
     '     o se corrige el rango para que diga lo que hay: un rango que no se cumple',
     '     manda a buscar dentro algo que no esta.'].join('\n'));

  /* INVENTARIO de lo declarado «omitir». Va como NOTA y no como aviso: es una
     decision tomada, no algo que arreglar, y un aviso que salta siempre por una
     decision deliberada se aprende a ignorar.
     Pero tiene que decirse, porque `omitir` es la unica prioridad cuyo efecto es
     una AUSENCIA —la tarjeta desaparece del plan y sus preguntas salen del
     banco— y las ausencias no se revisan: si sobra una, nada la delata. Con la
     lista delante, el autor la ve cada vez que verifica. */
  /* Con los ARTICULOS que cubre, no solo el nombre. Un nombre puede sonar
     prescindible —«Mesas de Negociacion»— y esconder tres articulos enteros, dos
     de ellos vivos. Una decision no se puede releer si no dice sobre QUE es.

     Los articulos se sacan por ESTRUCTURA y no con un patron: un id es de
     apartado si otro id es prefijo suyo (`sec-EBEP-20-1` cuelga de
     `sec-EBEP-20`). Adivinar la forma del id con un regex es lo que ya fallo al
     copiar `splitKey`: la forma la decide la app, la estructura no. */
  const omitidas = [...box.querySelectorAll('[data-prio="omitir"]')]
    .map(e => {
      const nombre = (((e.querySelector('.name') || {}).textContent) || '').trim()
        || e.getAttribute('data-mark-id') || '?';
      const ids = [...e.querySelectorAll('[id]')].map(x => x.id);
      const bases = ids.filter(a => !ids.some(b => b !== a && a.indexOf(b + '-') === 0));
      const arts = [...new Set(bases.map(x => x.slice(x.indexOf('-') + 1)))];
      return nombre + (arts.length ? ' (' + arts.join(', ') + ')' : '');
    });
  if(omitidas.length) add(id, 'info', 'declara-omitir',
    `declara ${omitidas.length} tarjeta(s) para omitir: ${omitidas.map(x => '«' + x + '»').join(', ')}`,
    ['No salen en el Plan de estudio y sus preguntas no caen en el banco. Si alguna',
     '     no deberia estar aqui, quitale `prioridad` — nada mas te lo va a decir.'].join('\n'));

  const prioMalas = [...box.querySelectorAll('[data-prio-invalido]')]
    .map(e => (((e.querySelector('.name') || {}).textContent || '').trim()
      || e.getAttribute('data-mark-id') || '?').slice(0, 34)
      + ' -> "' + e.getAttribute('data-prio-invalido') + '"');
  if(prioMalas.length) add(id, 'warn', 'prioridad-desconocida',
    `${prioMalas.length} tarjeta(s) declaran una prioridad que no existe${muestra(prioMalas)}`,
    ['Los valores validos son `omitir`, `baja`, `media` y `alta`. Uno desconocido no',
     '     se aplica y la tarjeta sale con el defecto (baja), igual que si no hubieras',
     '     declarado nada: sin error, sin aviso y sin diferencia visible.'].join('\n'));

  /* contrato de las tarjetas (agregado: una línea por tipo de fallo, con ejemplos) */
  const sinMark = [], sinNombre = [], porClave = new Map();
  for(const card of box.querySelectorAll('.card')){
    const nombre = card.querySelector('.card-head .name, .card-head .label');
    const tieneHijos = card.querySelector('.art-block[id], .card');
    const rotulo = (txt(nombre) || txt(card)).replace(/\s+/g, ' ').slice(0, 42) || '(sin texto)';
    const clave = card.getAttribute('data-mark-id');
    if(!clave && !tieneHijos) sinMark.push(rotulo);
    if(clave){ if(!porClave.has(clave)) porClave.set(clave, []); porClave.get(clave).push(rotulo); }
    if(!nombre) sinNombre.push(txt(card).replace(/\s+/g, ' ').slice(0, 42) || '(sin texto)');
  }

  /* Dos tarjetas con la MISMA clave son la misma tarjeta para todo lo que
     guarda estado: comparten importancia, prioridad y subrayados. Pasa al
     derivar la clave del título y tener dos títulos que slugifican igual
     («Árbol B» y «Árbol B+»). */
  for(const [clave, rotulos] of porClave){
    if(rotulos.length < 2) continue;
    add(id, 'error', 'clave-duplicada',
      `${rotulos.length} tarjetas comparten la clave \`${clave}\`${muestra(rotulos)}`,
      'Comparten importancia, prioridad del plan de estudio y subrayados: marcar una\n' +
      '     marca la otra. Ponle a una un `data-mark-id="…"` propio en su HTML.');
  }
  /* Inventario de claves del tema (identidades bajo las que hay estado guardado
     en el navegador del usuario). Lo consume `revisarClaves`. */
  const claves = new Set(porClave.keys());
  for(const sel of ['.art-block[id]', '.band[id]', '.apartado-head[id]'])
    for(const e of box.querySelectorAll(sel)) claves.add(e.id);
  clavesPorTema.set(id, [...claves].sort());
  if(sinMark.length) add(id, 'error', 'card-sin-markid',
    `${sinMark.length} tarjeta(s) sin \`data-mark-id\`${muestra(sinMark)}`,
    'Sin él no se puede marcar prioridad, no se indexa y no sale en el plan de estudio.\n' +
    '     Si la generas con renderCard/renderCardTreesInto, el SDK lo pone solo.');
  if(sinNombre.length) add(id, 'error', 'card-sin-nombre',
    `${sinNombre.length} tarjeta(s) sin \`.name\` ni \`.label\`${muestra(sinNombre)}`,
    'El indexador del buscador las ignora: su contenido no aparecerá al buscar.');

  /* el botón desplegable debe ir FUERA de .det (si no, queda recortado) */
  const disclosuresOcultos = box.querySelectorAll('.det .disclosure').length;
  if(disclosuresOcultos) add(id, 'error', 'disclosure-oculto',
    `${disclosuresOcultos} botón(es) \`.disclosure\` están DENTRO de \`.det\`.`,
    '`.det` se colapsa con max-height:0/overflow:hidden → el botón queda invisible e\n' +
    '     inpulsable. Sácalo fuera: <button class="disclosure">…</button><div class="det">…');

  /* cabeceras sin id: no agrupan en el plan de estudio */
  for(const sel of ['.band', '.apartado-head']){
    const sinId = [...box.querySelectorAll(sel)].filter(e => !e.id);
    if(sinId.length) add(id, 'warn', 'cabecera-sin-id',
      `${sinId.length} \`${sel}\` sin \`id\`.`,
      'No agrupan su contenido en el plan de estudio ni son enlazables ni priorizables.');
  }

  /* chips que apuntan a anclas inexistentes */
  for(const chip of (t.chips || [])){
    if(chip.anchor && !box.querySelector('#' + CSS.escape(chip.anchor)))
      add(id, 'warn', 'chip-roto', `El chip «${chip.label}» apunta a \`#${chip.anchor}\`, que no existe.`);
  }

  /* Glosario. Las claves de <2 letras el matcher las descarta en silencio.
     La ausencia en ESTE tema no es un fallo (un glosario compartido entre temas
     es un patrón válido): se acumula y al final se avisa solo de las claves que
     no aparecen en NINGÚN tema, que son las realmente muertas. */
  const cuerpo = txt(box);
  const glCorto = [];
  for(const clave of Object.keys(t.glossary || {})){
    const letras = clave.replace(/[^\p{L}\p{N}]/gu, '');
    if(letras.length < 2) glCorto.push(clave);
    else {
      if(!glosarioGlobal.has(clave)) glosarioGlobal.set(clave, false);
      if(cuerpo.includes(clave)) glosarioGlobal.set(clave, true);
    }
  }
  if(glCorto.length) add(id, 'warn', 'glosario-corto',
    `${glCorto.length} clave(s) de glosario con menos de 2 letras: se ignoran${muestra(glCorto)}`);

  /* Tema con siglas en el texto pero SIN glosario. Las siglas sin expandir son
     un modo de fallo típico de un tema generado desde un PDF (como las
     respuestas contaminadas). Aviso, no error: quizá el tema no las necesita.
     Solo salta si hay varias candidatas de verdad, para no dar la lata. */
  if(!Object.keys(t.glossary || {}).length){
    const candidatas = new Set((cuerpo.match(/\b[A-ZÁÉÍÓÚÑ]{2,6}\b/g) || [])
      .filter(s => !/^[IVXLCDM]+$/.test(s)));   // fuera numerales romanos (I, IV, LXX…)
    if(candidatas.size >= 4) add(id, 'warn', 'sin-glosario',
      `El tema no declara \`glossary\` pero su texto tiene ${candidatas.size} siglas${muestra([...candidatas])}`,
      'Cada materia mantiene UN glosario compartido (p.ej. tai-glossary.js) e importa\n' +
      '     `glossary: MI_GLOSARIO` en cada tema. Va por materia, no en appConfig global:\n' +
      '     las claves colisionan entre materias (IT = Incapacidad Temporal vs Information\n' +
      '     Technology). Ver §6 del skill.');
  }

  /* preguntas de examen. Ojo: `id` es OPCIONAL (hay temas que no lo usan);
     solo se comprueba la unicidad cuando existe. */
  const qs = t.questions || [];
  const qid = new Set(), dupQ = [], malaCorrecta = [], sinExp = [];
  const rotuloQ = (q, n) => (q.pregunta ? String(q.pregunta).replace(/\s+/g, ' ').slice(0, 46) : `#${n + 1}`);
  qs.forEach((q, n) => {
    if(q.id != null){
      if(qid.has(q.id)) dupQ.push(String(q.id));
      qid.add(q.id);
    }
    if(Array.isArray(q.respuestas) && q.correcta != null && !q.respuestas.includes(q.correcta))
      malaCorrecta.push(rotuloQ(q, n));
    if(!q.explicacion) sinExp.push(rotuloQ(q, n));
  });
  if(dupQ.length) add(id, 'error', 'pregunta-id',
    `${dupQ.length} pregunta(s) con id repetido${muestra(dupQ)}`);
  if(malaCorrecta.length) add(id, 'error', 'pregunta-correcta',
    `${malaCorrecta.length} pregunta(s) cuya \`correcta\` no está entre sus \`respuestas\`${muestra(malaCorrecta)}`,
    '`correcta` es el TEXTO exacto de una de las opciones (el SDK las baraja).');
  /* Respuestas CONTAMINADAS al importar de un PDF: se arrastra el encabezado de
     la sección siguiente pegado al final («MIMD Periféricos» en vez de «MIMD»).
     Es EL modo de fallo de las preguntas extraídas por IA de un documento, y
     nadie lo ve: el alumno memoriza la basura como si fuera la respuesta.
     Heurística: la respuesta TERMINA en el nombre de un apartado/sección del
     tema, pero no ES ese nombre. Aviso, no error: puede haber falsos positivos. */
  const rotulos = new Set();
  for(const a of (t.apartados || t.bloques || [])) rotulos.add(String(a.label || a.id || a).trim());
  for(const q of qs) if(q.apartado) rotulos.add(String(q.apartado).trim());
  const sospechosas = [];
  for(const q of qs){
    const resp = (q.respuestas || []).map(r => String(r).trim());
    for(const s of resp){
      for(const rot of rotulos){
        if(rot.length <= 3 || s.length <= rot.length + 1 || !s.endsWith(' ' + rot)) continue;
        /* Discriminante clave: si el nombre del apartado aparece TAMBIÉN en otra
           respuesta de la misma pregunta, es vocabulario legítimo del tema
           («…propuestos por el propio Defensor del Pueblo»), no basura pegada.
           La contaminación real solo ensucia UNA opción: la que quedó junto al
           salto de sección en el PDF. */
        const enHermanas = resp.some(o => o !== s && o.includes(rot));
        if(enHermanas) continue;
        /* Segundo discriminante: qué queda al quitar el sufijo. Si solo queda un
           artículo («El» + «Defensor del Pueblo»), el apartado ES la respuesta,
           no basura pegada. La contaminación real deja delante una respuesta
           completa por sí sola («MIMD», «Recorrido postorden»). */
        const prefijo = s.slice(0, s.length - rot.length - 1).trim();
        if(ARTICULOS.has(prefijo.toLowerCase())) continue;
        sospechosas.push(s.slice(0, 46));
      }
    }
  }
  if(sospechosas.length) add(id, 'warn', 'respuesta-contaminada',
    `${sospechosas.length} respuesta(s) acaban con el nombre de un apartado del tema${muestra([...new Set(sospechosas)])}`,
    'Suele ser el encabezado de la sección siguiente arrastrado al extraer del PDF.\n' +
    '     Compruébalas: si la contaminada es la CORRECTA, el alumno la memoriza mal.');

  if(sinExp.length) add(id, 'warn', 'pregunta-sin-explicacion',
    `${sinExp.length} de ${qs.length} pregunta(s) sin \`explicacion\`${muestra(sinExp)}`,
    'Es lo que el estudiante lee al fallar; sin ella la pregunta enseña poco.');
}

/* ---------- inventario de claves: detectar RENOMBRADOS ----------
   La clave de una tarjeta es la identidad bajo la que el navegador del usuario
   guarda su importancia, su prioridad y sus subrayados. Si la clave se deriva
   del título, renombrar la tarjeta cambia la clave y todo eso queda huérfano:
   la tarjeta aparece virgen y no hay ni un error ni una traza. Es invisible
   para cualquier comprobación que solo mire el DOM de HOY.
   Por eso se guarda el inventario de claves en un fichero versionado y se
   compara con el de la última vez. Salta SOLO cuando una clave desaparece —
   nunca al añadir contenido — y se apaga sola en cuanto se commitea el fichero
   actualizado, así que no hay aviso que se quede gritando de fondo. */
const CLAVES_FILE = '.apuntes-claves.json';

/* Referencia contra la que se comparan las claves: la versión COMMITEADA, no la
   del disco. El fichero del disco lo reescribe este mismo script, así que tras
   un renombrado la primera pasada ya lo ha actualizado y la siguiente compara
   contra las claves nuevas — el aviso sale entonces con los nombres invertidos,
   proponiendo como «clave vieja» la que acabas de estrenar. Lo commiteado es
   además lo correcto conceptualmente: son las claves bajo las que el usuario
   tiene guardadas sus marcas, y commitear el inventario es la forma de aceptar
   el cambio. Sin git (o con el fichero aún sin versionar) cae al disco. */
function baseDeClaves(raiz, ruta){
  const g = spawnSync('git', ['show', 'HEAD:./' + CLAVES_FILE], { cwd: raiz, encoding: 'utf8' });
  if(g.status === 0 && g.stdout){
    try { return JSON.parse(g.stdout); } catch { /* commiteado pero ilegible */ }
  }
  try { return JSON.parse(readFileSync(ruta, 'utf8')); } catch { return null; }
}

function revisarClaves(raiz){
  const ruta = join(raiz, CLAVES_FILE);
  const previo = baseDeClaves(raiz, ruta);

  if(previo){
    for(const [tema, antes] of Object.entries(previo)){
      const ahora = clavesPorTema.get(tema);
      if(!ahora) continue;                       // tema no revisado en esta pasada
      const set = new Set(ahora);
      const perdidas = antes.filter(k => !set.has(k));
      if(!perdidas.length) continue;
      const nuevas = ahora.filter(k => !antes.includes(k));
      const pista = nuevas.length
        ? 'Si es un RENOMBRADO, la marca del usuario se queda en la clave vieja y la\n' +
          `     tarjeta aparece sin marcar. Consérvale la identidad poniéndole en su HTML\n` +
          `     \`data-mark-id="${perdidas[0]}"\` (la clave vieja). Claves nuevas${muestra(nuevas)}.`
        : 'Si has borrado ese contenido es lo esperado. Si no, algo cambió el título del\n' +
          '     que sale la clave: ponle `data-mark-id="<clave vieja>"` para conservarla.';
      add(tema, 'warn', 'clave-perdida',
        `${perdidas.length} clave(s) que existían ya no están${muestra(perdidas)}`, pista);
    }
  }

  /* Se reescribe (conservando los temas que no se han revisado): así el aviso
     salta una vez, en el commit del renombrado, y no vuelve.
     El inventario cubre TODOS los temas, así que lo reescribe cualquier carril
     al verificar. Por eso se respeta el fin de línea que ya tenga el fichero: en
     Windows git lo deja en CRLF, y escribirlo en LF lo marcaba como modificado
     en cada `verify` aunque el contenido fuera idéntico. Ese cambio fantasma de
     un fichero compartido acaba colándose en el commit de alguien.
     OJO: lo que se escribe parte del fichero EN DISCO, no de `previo` —que
     ahora viene de git—. Partir de git borraría del inventario los temas que
     otro carril haya verificado y aún no haya commiteado. */
  let enDisco = null;
  try { enDisco = readFileSync(ruta, 'utf8'); } catch { /* aún no existe */ }
  let previoDisco = null;
  try { previoDisco = JSON.parse(enDisco); } catch { previoDisco = null; }
  const salida = { ...(previoDisco || previo || {}) };
  for(const [tema, ks] of clavesPorTema) salida[tema] = ks;
  const eol = enDisco && enDisco.includes('\r\n') ? '\r\n' : '\n';
  const texto = '{' + eol + Object.keys(salida).sort()
    .map(t => `  ${JSON.stringify(t)}: ${JSON.stringify(salida[t])}`).join(',' + eol) + eol + '}' + eol;
  try {
    if(enDisco !== texto){
      writeFileSync(ruta, texto);
      if(!previo) console.log(`${DIM}· Creado ${CLAVES_FILE} (inventario de claves). Commitéalo: es lo que permite\n  avisar de un renombrado que dejaría huérfanas las marcas del usuario.${RESET}`);
    }
  } catch { /* checkout de solo lectura: el resto de la verificación sigue valiendo */ }
}

/* ---------- informe ---------- */
function informe(nTemas){
  const errores = findings.filter(f => f.level === 'error');
  const avisos  = findings.filter(f => f.level === 'warn');
  /* `info` NO cuenta como aviso: describe una decision ya tomada, no algo por
     arreglar. Un aviso que salta siempre por algo deliberado se aprende a
     ignorar, y con el se van los que si importan — pero una decision cuyo
     efecto es una AUSENCIA tampoco puede quedar sin decirse, porque nadie
     revisa lo que no esta. El informe la enseña y el recuento no la suma. */
  const infos = findings.filter(f => f.level === 'info');
  const porTema = new Map();
  for(const f of findings){ if(!porTema.has(f.tema)) porTema.set(f.tema, []); porTema.get(f.tema).push(f); }

  for(const [tema, fs] of porTema){
    console.log(`\n${B}${tema}${RESET}`);
    for(const f of fs){
      const tag = f.level === 'error' ? `${RED}✗ error${RESET}`
        : (f.level === 'info' ? `${DIM}· nota${RESET}` : `${YEL}! aviso${RESET}`);
      console.log(`  ${tag} ${DIM}[${f.code}]${RESET} ${f.msg}`);
      if(f.hint) console.log(`     ${DIM}→ ${f.hint}${RESET}`);
    }
  }

  console.log(`\n${DIM}─────────────────────────────${RESET}`);
  if(!errores.length && !avisos.length){
    console.log(`${GRN}✓ ${nTemas} tema(s) verificados: todo en orden.${RESET}`
      + (infos.length ? `${DIM} (${infos.length} nota(s) informativa(s) arriba)${RESET}` : ''));
    return 0;
  }
  console.log(`${nTemas} tema(s) · ${errores.length ? RED : ''}${errores.length} error(es)${RESET} · ${avisos.length} aviso(s)`
    + (infos.length ? `${DIM} · ${infos.length} nota(s)${RESET}` : ''));
  if(errores.length){
    console.log(`${RED}✗ Hay errores que romperán funciones del SDK.${RESET}`);
    return 1;
  }
  console.log(`${GRN}✓ Sin errores${RESET} (los avisos no rompen nada, pero conviene mirarlos).`);
  return 0;
}

/* ---------- main ---------- */
// Comentarios de bloque cerrados por accidente. Un cierre (asterisco pegado a
// barra) dentro del propio comentario —típico al listar selectores con comodín,
// como ".sv-" seguido de asterisco y barra— lo termina antes de tiempo y deja el
// resto como código suelto: esbuild avisa en CADA build y, en JS, rompe el
// módulo. Ha mordido cuatro veces ya, incluida esta misma función al escribirla:
// por eso va con comentarios de línea, que no pueden morderse a sí mismos.
function revisarComentarios(raiz){
  const exts = new Set(['.css', '.js', '.mjs']);
  const sospechosas = [];
  const walk = (dir) => {
    let entradas = [];
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for(const e of entradas){
      if(e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if(e.isDirectory()){ walk(p); continue; }
      if(!exts.has(extname(e.name))) continue;
      let txt = ''; try { txt = readFileSync(p, 'utf8'); } catch { continue; }
      txt.split('\n').forEach((linea, n) => {
        const abre = linea.indexOf('/*');
        if(abre === -1) return;
        /* Dentro del comentario, un cierre precedido de guion o alfanumérico
           es accidental (el legítimo va tras un espacio o al final de línea). */
        const resto = linea.slice(abre + 2);
        const m = resto.match(/[\w-]\*\//);
        if(m) sospechosas.push(relative(raiz, p).replace(/\\/g, '/') + ':' + (n + 1));
      });
    }
  };
  walk(raiz);
  if(sospechosas.length) add('(app)', 'warn', 'comentario-roto',
    `${sospechosas.length} comentario(s) de bloque se cierran por accidente${muestra(sospechosas)}`,
    'Un cierre de comentario pegado a texto (asterisco+barra tras una palabra, típico\n' +
    '     al listar selectores con comodín) termina el comentario antes de tiempo: el\n' +
    '     resto queda como código suelto. Separa el asterisco de la barra, o reescribe\n' +
    '     la lista sin barras.');
}

/* Referencia de una pregunta al temario (`q.articulo`) que no resuelve.

   El fallo no da sintoma: si la clave no casa, el boton «Ver en el temario»
   simplemente NO SE PINTA. Ni error, ni hueco, ni nada raro — la pregunta se ve
   perfecta y pierde su enlace. Es el mismo perfil que el glosario muerto.

   Y separa DOS cosas que parecen la misma, porque una es un error y la otra una
   decision:
     · `ref-mal-escrita`  la clave no tiene el formato del motor («13 LODP» en vez
                          de «LODP-13», o «75.3» cuando la buena es «CE-75.3»).
     · `ref-sin-desarrollar` la clave esta bien puesta pero ese articulo aun no se
                          desarrolla en ningun tema. No hay nada que arreglar: el
                          modal lo dice y la explicacion sigue enseñando.
   Sin esa separacion el aviso saldria en los dos casos, y un aviso que salta por
   decisiones deliberadas se aprende a ignorar — con el se van tambien los reales. */
/* El `splitKey` DE VERDAD, no una copia. Duplicarlo costo un falso positivo de
   124 referencias: `keySplit` no es un separador sino un MODO ('last' = partir
   por el ultimo punto), y la copia lo uso como separador, asi que ninguna clave
   con apartado se partia. Verify vive dentro del paquete, asi que puede
   importarlo por ruta relativa aunque `exports` no publique el subpath. */
let splitKey = (k) => { const i = String(k).indexOf('.'); return i === -1 ? [String(k), null] : [String(k).slice(0, i), String(k).slice(i + 1)]; };
try {
  ({ splitKey } = await import('../src/core/panels.js'));
} catch { /* sin el modulo se usa el corte simple: peor, pero no calla la regla */ }

/* Los EXAMENES no viven en el registro (los declara la app con `setExamenes`),
   asi que auditar solo `t.questions` deja fuera justo donde mas referencias hay.
   Se buscan por convencion en una carpeta `examenes/` junto al registro, y se
   DICE cuantos se han auditado: una comprobacion que cubre la mitad sin avisar
   es peor que ninguna, porque se lee como si cubriera todo. */
async function cargarExamenes(registryPath){
  const dir = resolve(registryPath, '..', 'examenes');
  if(!existsSync(dir)) return { examenes: [], dir: null };
  const out = [];
  let entradas = [];
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return { examenes: [], dir: null }; }
  for(const e of entradas){
    if(e.isDirectory() || !/\.(js|mjs)$/.test(e.name)) continue;
    try {
      const mod = await import(pathToFileURL(join(dir, e.name)).href);
      const ex = mod.default || mod.examen;
      if(ex && Array.isArray(ex.preguntas)) out.push({ id: ex.id || e.name, preguntas: ex.preguntas });
    } catch { /* un examen que no importa ya lo cazan otras comprobaciones */ }
  }
  return { examenes: out, dir };
}

function revisarRefs(TEMAS, EXAMENES, declarados){
  /* Prefijos REALES: los que aparecen en las claves declaradas, no una lista
     adivinada. Si manana una materia usa otro, esto lo aprende solo. */
  /* Si la app EXPORTA sus `externalPrefixes` desde el registro, se usan esos y
     punto. Derivarlos de las claves era adivinar de mas: daba por buena
     `LOTC-8` porque quitando el prefijo queda un `8`... de otra norma. Con la
     lista declarada la comprobacion es exacta y deja de haber un aviso que solo
     dice «no puedo saberlo». */
  /* DOS conjuntos, porque son dos preguntas distintas y confundirlas clasifica mal:
       · `prefijos`  — los que el motor puede QUITAR (los declara la app).
       · `conocidos` — los que aparecen en las claves reales, para saber si un
                       prefijo es plausible o se lo ha inventado el autor.
     `LOTC-` es conocido (hay secciones LOTC-*) y NO es de quitar: una referencia
     `LOTC-8` esta bien escrita y apunta a algo sin desarrollar, no es un error. */
  const prefijos = new Set(Array.isArray(declarados) ? declarados : []);
  const conocidos = new Set();
  const sonDeclarados = Array.isArray(declarados);
  let hayClavesPlanas = false;
  for(const t of TEMAS){
    for(const k of Object.keys((t.engine && t.engine.sections) || {})){
      const m = String(k).match(/^([A-Za-zÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚÑ]*)-/);
      if(m){ conocidos.add(m[1] + '-'); if(!sonDeclarados) prefijos.add(m[1] + '-'); }
      else hayClavesPlanas = true;
    }
  }
  const directo = (key) => {
    for(const t of TEMAS){
      const secs = (t.engine && t.engine.sections) || {};
      const [base] = splitKey(key, t.engine && t.engine.keySplit);
      if(secs[base]) return true;
    }
    return false;
  };
  /* El motor tambien resuelve QUITANDO el prefijo (`externalPrefixes`): una clave
     `CE-62` de una materia con prefijos apunta al `62` de otra que usa claves
     planas. Sin esta segunda vuelta la regla acusaba a seis referencias que en la
     app funcionan — comprobar la mitad del mecanismo es peor que no comprobarlo,
     porque el aviso parece autoridad. */
  /* Devuelve null si no resuelve, '' si resuelve directo, o el prefijo que hubo
     que QUITAR para que resolviera. Esa tercera respuesta importa: quitar
     prefijos solo lo hace la app si los declara en `externalPrefixes`, y verify
     no puede leer esa config (vive en el arranque de la app, no en el registro).
     Dando por bueno cualquier prefijo derivado de las claves, la regla decia que
     `LOTC-8` resolvia cuando en la app no lo hace: un falso NEGATIVO, que es el
     peor error de un comprobador porque no deja rastro. */
  const comoResuelve = (key) => {
    if(directo(key)) return '';
    for(const p of prefijos){
      if(String(key).indexOf(p) === 0 && directo(String(key).slice(p.length))) return p;
    }
    return null;
  };
  const resuelve = (key) => comoResuelve(key) !== null;

  const malEscritas = [], sinDesarrollar = [], ambiguas = [], dependenPrefijo = [];
  /* Un examen no pertenece a ningun tema, asi que su `t.id` es su propio id y no
     puede desempatar una clave ambigua: por eso ahi el aviso SI sale. */
  const fuentes = [...TEMAS, ...(EXAMENES || []).map(e => ({ id: e.id, questions: e.preguntas, esExamen: true }))];
  for(const t of fuentes){
    /* TODAS las referencias, no solo la principal. Auditar `articulo` y dejar
       `articulos` sin mirar seria comprobar la mitad — y la mitad que se deja
       fuera es justo la que se añade despues, cuando ya nadie vuelve a revisar. */
    const refsDe = (q) => {
      const lista = Array.isArray(q.articulos) && q.articulos.length
        ? q.articulos : (q.articulo ? [q.articulo] : []);
      /* Cada entrada puede traer SU temaId; perderlo aqui daria un falso
         «ambigua» en cuanto alguien lo use para desempatar una clave plana. */
      return lista.map(x => (x && typeof x === 'object')
        ? { ref: String(x.ref != null ? x.ref : ''), temaId: x.temaId || q.temaId || '' }
        : { ref: String(x), temaId: q.temaId || '' })
        .filter(r => r.ref);
    };
    for(const q of (t.questions || [])){
      for(const rr of refsDe(q)){
        const k = rr.ref;
      /* AMBIGUA: mas de un tema reclama la clave. Con claves planas pasa de
         verdad — el «37» es un articulo de la Constitucion y otro de la Ley de
         Transparencia — y entonces gana el primero del registro. No es una
         referencia rota: se abre un panel correcto, de un articulo real, que no
         es el de la pregunta. Por eso va aparte de las otras dos.
         El tema de la propia pregunta desempata, asi que solo se avisa cuando NO
         puede: cuando el dueño no esta entre los candidatos. */
      const duenos = TEMAS.filter(x => {
        const secs = (x.engine && x.engine.sections) || {};
        const [b] = splitKey(k, x.engine && x.engine.keySplit);
        return !!secs[b];
      }).map(x => x.id);
      const desempata = t.esExamen ? (rr.temaId || '') : t.id;
      if(duenos.length > 1 && duenos.indexOf(desempata) === -1)
        ambiguas.push(`${t.id} · "${k}" → ${duenos.join(' o ')}`);
      const via = comoResuelve(k);
      if(via && !sonDeclarados){ dependenPrefijo.push(`${t.id} · "${k}" (quitando «${via}»)`); }
      if(via !== null) continue;

      /* 1. Espacios: NINGUNA clave declarada lleva ninguno. Ademas se puede
            sugerir la buena reordenando los trozos («13 LODP» → «LODP-13»). */
      if(/\s/.test(k)){
        const trozos = k.split(/\s+/).filter(Boolean);
        const pref = trozos.find(x => prefijos.has(x + '-'));
        const num = trozos.find(x => /^[0-9]/.test(x));
        const sug = (pref && num) ? pref + '-' + num : null;
        malEscritas.push(`${t.id} · "${k}"` + (sug && resuelve(sug) ? ` → "${sug}"` : ''));
        continue;
      }
      /* 2. Prefijo olvidado: si la MISMA clave resuelve anteponiendole uno de los
            prefijos reales, no es un articulo sin desarrollar — es que falta el
            prefijo. Este es el caso que la forma sola no distingue, porque hay
            materias con claves planas donde «75.3» tambien seria valido. */
      let sugerida = null;
      for(const p of conocidos){ if(resuelve(p + k)){ sugerida = p + k; break; } }
      if(sugerida){ malEscritas.push(`${t.id} · "${k}" → "${sugerida}"`); continue; }
      /* 3. Prefijo inventado: lleva uno que no usa ninguna materia. */
      const m = k.match(/^([A-Za-zÁÉÍÓÚÑ][A-Za-z0-9ÁÉÍÓÚÑ]*)-/);
      if(m && !conocidos.has(m[1] + '-')){ malEscritas.push(`${t.id} · "${k}"`); continue; }
      /* 4. Bien escrita y sin destino: decision, no error. */
      sinDesarrollar.push(`${t.id} · "${k}"`);
      }
    }
  }

  if(malEscritas.length) add('(app)', 'warn', 'ref-mal-escrita',
    `${malEscritas.length} referencia(s) de pregunta no casan con el formato de claves${muestra(malEscritas)}`,
    'La clave no tiene la forma que usa el motor, asi que «Ver en el temario» NO\n' +
    '     SE PINTA: sin error y sin hueco, la pregunta se ve perfecta y pierde su\n' +
    '     enlace. Donde sale una flecha, esa es la clave que si resuelve.');
  if(dependenPrefijo.length) add('(app)', 'warn', 'ref-prefijo-externo',
    `${dependenPrefijo.length} referencia(s) solo resuelven si la app declara ese prefijo: ${[...new Set(dependenPrefijo)].map(x => '«' + x + '»').join(', ')}`,
    'Estas claves NO existen tal cual: resolverian quitandoles el prefijo, y eso\n' +
    '     solo lo hace la app si el prefijo esta en `externalPrefixes` (config que este\n' +
    '     script no puede leer). Dos cosas que comprobar, y la segunda es la\n' +
    '     traicionera: (1) que el prefijo este declarado; (2) que quitarlo lleve a LA\n' +
    '     MISMA norma. «CE-62» → el 62 de un tema con los articulos de la\n' +
    '     Constitucion es correcto; «LOTC-8» → el 8 de ese mismo tema NO lo es, porque\n' +
    '     el 8 de la LOTC no es el 8 de la CE. Ahi declarar el prefijo empeora las\n' +
    '     cosas: cambia «sin boton» por «boton al articulo equivocado».');
  if(ambiguas.length) add('(app)', 'warn', 'ref-ambigua',
    `${ambiguas.length} referencia(s) las reclaman dos temas y gana el orden del registro${muestra(ambiguas)}`,
    'Dos materias usan la misma clave plana (el «37» de la Constitucion y el de la\n' +
    '     Ley de Transparencia) y resuelve el PRIMERO del registro. No se ve como un\n' +
    '     fallo: abre un panel correcto, de un articulo real, que no es el de la\n' +
    '     pregunta. Declara `temaId` en la pregunta —el banco lo pone solo, un examen\n' +
    '     hay que declararlo— o usa la clave con prefijo.');
  if(sinDesarrollar.length) add('(app)', 'warn', 'ref-sin-desarrollar',
    `${sinDesarrollar.length} referencia(s) apuntan a articulos que ningun tema desarrolla${muestra(sinDesarrollar)}`,
    'Estan BIEN escritas: el problema no es la clave sino que ese articulo aun no\n' +
    '     tiene tarjeta. No hay nada que corregir en la pregunta — el modal lo dice\n' +
    '     («fuera del temario actual») y la explicacion sigue enseñando. Sale como\n' +
    '     aviso para que la lista de lo que falta por desarrollar no haya que\n' +
    '     mantenerla a mano.');
}

/* Un motor de pasos casero: temporizador que se repite y ningun `mountStepper`.
   Reprogramarse con setTimeout cuenta igual que setInterval — es la forma que se
   me escapo la primera vez que busque esto a mano. */
function revisarMotores(raiz){
  const sospechosos = [];
  const walk = (dir) => {
    let entradas = [];
    try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for(const e of entradas){
      if(e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if(e.isDirectory()){ walk(p); continue; }
      if(extname(e.name) !== '.js' && extname(e.name) !== '.mjs') continue;
      let txt = ''; try { txt = readFileSync(p, 'utf8'); } catch { continue; }
      /* NO se indulta al fichero por mencionar `mountStepper`. Un modulo puede
         montar una escena con el motor del SDK y llevar otra a mano — pasa de
         verdad — y entonces el temporizador casero sigue teniendo su problema.
         Ademas la mencion colaba desde un comentario HTML dentro de una
         plantilla, que no es comentario para JS: el comentario que reconocia el
         motor casero era justo lo que apagaba el aviso del motor casero. */
      const sinComentarios = txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
      let motivo = null;
      if(/\bsetInterval\s*\(/.test(sinComentarios)) motivo = 'setInterval';
      else {
        /* setTimeout(tick, …) donde `tick` es una funcion de este mismo fichero
           que vuelve a llamar a setTimeout: es un bucle, no un retardo suelto. */
        for(const m of sinComentarios.matchAll(/setTimeout\s*\(\s*([A-Za-z_$][\w$]*)/g)){
          const nombre = m[1];
          const cuerpo = new RegExp('function\\s+' + nombre + '\\s*\\([\\s\\S]{0,900}?setTimeout');
          if(cuerpo.test(sinComentarios)){ motivo = 'setTimeout que se reprograma'; break; }
        }
      }
      if(motivo) sospechosos.push(relative(raiz, p).replace(/\\/g, '/') + ' (' + motivo + ')');
    }
  };
  walk(raiz);
  if(sospechosos.length) add('(app)', 'warn', 'motor-propio',
    `${sospechosos.length} modulo(s) mueven pasos con su propio temporizador${muestra(sospechosos)}`,
    'Un reproductor a mano reimplementa lo que ya da `mountStepper` (controles,\n' +
    '     contador, guarda del timer si la vista se re-renderiza) y suele dejarse fuera\n' +
    '     lo unico que no se ve al probar con el raton: el `aria-live` que narra el paso.\n' +
    '     Si la escena tiene pasos, montala con `mountStepper`.');
}

const okSinDom = pasadaSinDom();
revisarComentarios(resolve(registryPath, '..', '..'));
revisarMotores(resolve(registryPath, '..', '..'));
const document = await montarDom();

let TEMAS, PREFIJOS_DECLARADOS = null;
try {
  const mod = await import(registryUrl);
  TEMAS = mod.TEMAS || mod.default;
  /* Opcional: si el registro los exporta, `verify` comprueba con la lista real
     en vez de deducirla. Ver la nota de `revisarRefs`. */
  PREFIJOS_DECLARADOS = mod.EXTERNAL_PREFIXES || mod.externalPrefixes || null;
} catch (e) {
  add('(app)', 'error', 'import', `No se pueden importar los temas: ${e.message}`);
  process.exit(informe(0) || 1);
}
if(!Array.isArray(TEMAS)){
  add('(app)', 'error', 'registro', 'El registro no exporta un array `TEMAS`.');
  process.exit(informe(0) || 1);
}

const idsVistos = new Set(), idsGlobales = new Map();
for(const t of TEMAS){
  revisarManifiesto(t, idsVistos);
  revisarEngine(t);
  if(typeof t.renderContent !== 'function') continue;
  const box = document.createElement('div');
  try { t.renderContent(box); }
  catch (e) {
    add(t.id || '(sin id)', 'error', 'render', `\`renderContent\` lanza: ${e.message}`,
      'Un tema que no renderiza sin navegador rompe el build y las herramientas.');
    continue;
  }
  revisarDom(t, box, idsGlobales);
}

const { examenes: EXAMENES, dir: dirEx } = await cargarExamenes(registryPath);
revisarRefs(TEMAS, EXAMENES, PREFIJOS_DECLARADOS);
revisarClaves(resolve(registryPath, '..', '..'));

/* Claves de glosario que no aparecen en NINGÚN tema: esas sí están muertas. */
const muertas = [...glosarioGlobal].filter(([, visto]) => !visto).map(([k]) => k);
if(muertas.length) add('(app)', 'warn', 'glosario-muerto',
  `${muertas.length} clave(s) de glosario no aparecen en ningún tema${muestra(muertas)}`,
  'Nunca se envolverán. Revisa la grafía (el matcher distingue mayúsculas) o retíralas.');

process.exit(informe(TEMAS.length) || (okSinDom ? 0 : 1));
