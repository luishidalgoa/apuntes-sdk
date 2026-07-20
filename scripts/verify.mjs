#!/usr/bin/env node
/* `apuntes-verify` — comprueba que los temas de una app cumplen el contrato del
   SDK ANTES de que falle en manos del usuario.

   Cada comprobación existe porque el fallo correspondiente ocurrió de verdad:
   - ids duplicados            → un deep-link aterrizaba en la tarjeta equivocada
   - .card sin data-mark-id    → invisible para buscador, plan de estudio y marcador
   - tarjeta sin .name/.label  → el indexador se la saltaba: el tema no salía al buscar
   - .disclosure dentro de .det→ el botón quedaba recortado e inpulsable
   - APIs de navegador al importar → rompía los scripts de línea de comandos
   - glosario con claves <2 letras o ausentes del texto → se ignoraban en silencio

   Uso:  apuntes-verify [ruta/al/registry.js]     (por defecto ./src/registry.js) */

import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

function revisarDom(t, box, idsGlobales){
  const id = t.id;

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

  /* contrato de las tarjetas (agregado: una línea por tipo de fallo, con ejemplos) */
  const sinMark = [], sinNombre = [];
  for(const card of box.querySelectorAll('.card')){
    const nombre = card.querySelector('.card-head .name, .card-head .label');
    const tieneHijos = card.querySelector('.art-block[id], .card');
    const rotulo = (txt(nombre) || txt(card)).replace(/\s+/g, ' ').slice(0, 42) || '(sin texto)';
    if(!card.getAttribute('data-mark-id') && !tieneHijos) sinMark.push(rotulo);
    if(!nombre) sinNombre.push(txt(card).replace(/\s+/g, ' ').slice(0, 42) || '(sin texto)');
  }
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
  if(sinExp.length) add(id, 'warn', 'pregunta-sin-explicacion',
    `${sinExp.length} de ${qs.length} pregunta(s) sin \`explicacion\`${muestra(sinExp)}`,
    'Es lo que el estudiante lee al fallar; sin ella la pregunta enseña poco.');
}

/* ---------- informe ---------- */
function informe(nTemas){
  const errores = findings.filter(f => f.level === 'error');
  const avisos  = findings.filter(f => f.level === 'warn');
  const porTema = new Map();
  for(const f of findings){ if(!porTema.has(f.tema)) porTema.set(f.tema, []); porTema.get(f.tema).push(f); }

  for(const [tema, fs] of porTema){
    console.log(`\n${B}${tema}${RESET}`);
    for(const f of fs){
      const tag = f.level === 'error' ? `${RED}✗ error${RESET}` : `${YEL}! aviso${RESET}`;
      console.log(`  ${tag} ${DIM}[${f.code}]${RESET} ${f.msg}`);
      if(f.hint) console.log(`     ${DIM}→ ${f.hint}${RESET}`);
    }
  }

  console.log(`\n${DIM}─────────────────────────────${RESET}`);
  if(!findings.length){
    console.log(`${GRN}✓ ${nTemas} tema(s) verificados: todo en orden.${RESET}`);
    return 0;
  }
  console.log(`${nTemas} tema(s) · ${errores.length ? RED : ''}${errores.length} error(es)${RESET} · ${avisos.length} aviso(s)`);
  if(errores.length){
    console.log(`${RED}✗ Hay errores que romperán funciones del SDK.${RESET}`);
    return 1;
  }
  console.log(`${GRN}✓ Sin errores${RESET} (los avisos no rompen nada, pero conviene mirarlos).`);
  return 0;
}

/* ---------- main ---------- */
const okSinDom = pasadaSinDom();
const document = await montarDom();

let TEMAS;
try {
  const mod = await import(registryUrl);
  TEMAS = mod.TEMAS || mod.default;
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

/* Claves de glosario que no aparecen en NINGÚN tema: esas sí están muertas. */
const muertas = [...glosarioGlobal].filter(([, visto]) => !visto).map(([k]) => k);
if(muertas.length) add('(app)', 'warn', 'glosario-muerto',
  `${muertas.length} clave(s) de glosario no aparecen en ningún tema${muestra(muertas)}`,
  'Nunca se envolverán. Revisa la grafía (el matcher distingue mayúsculas) o retíralas.');

process.exit(informe(TEMAS.length) || (okSinDom ? 0 : 1));
