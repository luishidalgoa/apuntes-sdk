/* Marcar IMPORTANCIA de bloques de contenido (app de un solo usuario →
   localStorage). Genérico: funciona sobre tarjetas (.card), bloques de sección
   (.art-block) y bandas/títulos (.band[id]). Cada bloque marcable expone un id
   estable por tema: en tarjetas `data-mark-id` (lo pone renderCard), en bloques
   y bandas el propio `id`.

   NIVELES:  -1 = omitir (azul) · 1 = baja (verde) · 2 = media (ámbar) · 3 = alta (rojo)

   BAJA ES EL DEFECTO, no un estado que haya que elegir: todo lo que no tiene
   nivel asignado ES de prioridad baja, y así se pinta. Antes existía un «sin
   marcar» (0) distinto de «baja», y la distinción no significaba nada para quien
   estudia — lo que no has marcado no es que no tenga importancia, es que tiene
   la que traía de serie.

   OMITIR va POR DEBAJO del defecto porque es la única marca que dice algo que el
   defecto no puede decir: «esto he decidido saltármelo». Por eso no se llega a
   ella subiendo, y por eso el ciclo la deja al final del recorrido — se elige a
   propósito, no de paso.

   El ciclo es baja → media → alta → omitir → baja. En almacenamiento, `baja` se
   guarda como AUSENCIA (se borra la clave): así el defecto no ocupa nada y el
   inventario solo lista lo que decidiste de verdad.
   Estado: { temaId: { id: nivel } }. */

const KEY = 'tai-marks';
const OMITIR = -1;
const DEFECTO = 1;                       // «baja»: lo que trae todo de serie
/* Recorrido del clic. `baja` va primero porque es donde empieza todo, y `omitir`
   al final: se elige a propósito, no de paso. */
const CICLO = [1, 2, 3, OMITIR];
const LEVEL_NAMES = { [OMITIR]: 'omitir', 1: 'baja', 2: 'media', 3: 'alta' };

/* NIVELES DECLARADOS POR EL CONTENIDO.

   El autor puede marcar un bloque con `data-prio="omitir"` y eso pasa a ser SU
   DEFECTO — no una imposición: cuenta como punto de partida, y en cuanto el
   usuario toca ese bloque manda lo suyo. El caso real es un temario anotado a
   mano donde el propio opositor ya decidió en papel qué se salta; el contenido
   solo traslada esa decisión, no la sustituye.

   Por qué no se «siembra» en localStorage, que es lo primero que uno piensa:
   sembrar obliga a distinguir «nunca tocado» de «tocado y devuelto al defecto»,
   y como `baja` se guarda borrando la clave, esas dos cosas se escriben igual.
   Se resolvería con una marca de «ya sembrado», pero entonces cambiar la
   declaración más tarde no llegaría a quien ya la tuviera sembrada.

   Tratarlo como DEFECTO en vez de como valor inicial evita las dos cosas: no
   hay estado que migrar, y si el autor cambia la declaración, la ve todo el que
   no haya decidido por su cuenta. Lo único que hace falta es guardar tambien
   `baja` cuando es una decision explicita (ver `cycleMark`). */
const DECLARADAS = new Map();          // temaId → { id: nivel }
const NOMBRE_A_NIVEL = { omitir: OMITIR, baja: 1, media: 2, alta: 3 };

/* Registra lo declarado leyendo un DOM ya renderizado. Lo llaman `bindMarks` y
   el Plan de estudio, que ya tienen el árbol delante: no cuesta un render extra. */
export function registrarDeclaradas(temaId, root){
  if(!temaId || !root || DECLARADAS.has(temaId)) return;
  const map = {};
  root.querySelectorAll('[data-prio]').forEach(el => {
    const n = NOMBRE_A_NIVEL[String(el.getAttribute('data-prio')).toLowerCase()];
    const id = el.getAttribute('data-mark-id') || el.id;
    if(n && id) map[id] = n;
  });
  DECLARADAS.set(temaId, map);
}
/* Rellena el registro de los temas que aún no se hayan visitado, renderizándolos
   en un div suelto. Hace falta porque el BANCO se puede abrir desde la portada
   sin haber entrado en ningún tema: sin esto, una tarjeta declarada «omitir»
   seguiría soltando sus preguntas hasta que alguien abriera su tema — un fallo
   que depende de por dónde entres, de los que no dan síntoma. Cachea por tema,
   así que la segunda llamada no cuesta nada. */
export function precargarDeclaradas(temas){
  for(const t of (temas || [])){
    if(!t || !t.id || DECLARADAS.has(t.id) || typeof t.renderContent !== 'function') continue;
    try {
      const box = document.createElement('div');
      t.renderContent(box);
      registrarDeclaradas(t.id, box);
    } catch(e){ DECLARADAS.set(t.id, {}); }   // un tema que no renderiza no bloquea al resto
  }
}
export function nivelDeclarado(temaId, id){
  const m = DECLARADAS.get(temaId);
  return (m && m[id]) || 0;
}
/* Defecto EFECTIVO de una clave: lo que declara el contenido, o baja. */
function defectoDe(temaId, id){ return nivelDeclarado(temaId, id) || DEFECTO; }

function readAll(){ try{ return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }catch(e){ return {}; } }
function writeAll(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

/* Devuelve el mapa { id: nivel } del tema. MIGRA el formato antiguo
   ({ temaId: [ids] } booleano) a niveles: los marcados pasan a "alta" (3), que
   es lo que significaban. Se reescribe la primera vez que se lee ese tema. */
function levelsOf(temaId){
  const all = readAll();
  const v = all[temaId];
  if(Array.isArray(v)){
    const map = {}; v.forEach(id => { map[id] = 3; });
    all[temaId] = map; writeAll(all);
    return map;
  }
  return v || {};
}

/* Nivel efectivo: el guardado o el defecto (baja). Nunca devuelve 0 — ese estado
   ya no existe. */
export function markLevel(temaId, id){
  const v = levelsOf(temaId)[id];
  return (v === undefined || v === null || v === 0) ? defectoDe(temaId, id) : v;
}
/* Nivel DECLARADO: lo que el usuario eligió de verdad, o 0 si nunca tocó esto.
   Sirve para inventariar decisiones, no para pintar. */
export function markSet(temaId, id){ return levelsOf(temaId)[id] || 0; }
export function isOmitido(temaId, id){ return markLevel(temaId, id) === OMITIR; }
export function markedIds(temaId){ return new Set(Object.keys(levelsOf(temaId))); }
/* compat: «marcado» pasa a significar «con nivel declarado distinto del defecto». */
export function isMarked(temaId, id){ const v = levelsOf(temaId)[id]; return !!v && v !== DEFECTO; }

/* Cicla: baja → media → alta → omitir → baja. Devuelve el nuevo nivel.
   `baja` se guarda borrando la clave, así el mapa solo contiene decisiones. */
export function cycleMark(temaId, id){
  const all = readAll();
  let map = all[temaId];
  if(Array.isArray(map)){ const m = {}; map.forEach(x => { m[x] = 3; }); map = m; }
  map = map || {};
  const def = defectoDe(temaId, id);
  const actual = (map[id] === undefined || map[id] === null || map[id] === 0) ? def : map[id];
  const i = CICLO.indexOf(actual);
  const next = CICLO[(i === -1 ? 0 : i + 1) % CICLO.length];
  /* Se guarda solo la DESVIACIÓN respecto al defecto de esa clave. Así el mapa
     sigue conteniendo únicamente decisiones, y la ausencia significa una sola
     cosa: «aquí mando yo, el contenido». Si el defecto es `omitir` porque lo
     declara el tema y el usuario lo sube a `baja`, eso SÍ se guarda — es una
     decisión suya, y borrar la clave la haría volver a omitir en la próxima
     visita. */
  if(next === def) delete map[id]; else map[id] = next;
  all[temaId] = map; writeAll(all);
  return next;
}
/* compat: toggle → cicla (no lo usa la app). */
export function toggleMark(temaId, id){ return cycleMark(temaId, id) > 0; }

function levelTitle(level){
  const n = LEVEL_NAMES[level] || LEVEL_NAMES[DEFECTO];
  return level === OMITIR
    ? 'Marcado para OMITIR · clic para volver a baja'
    : ('Prioridad: ' + n + ' · clic: baja › media › alta › omitir');
}
/* Botón indicador: 3 barras que se rellenan y colorean según el nivel (el CSS lo
   pinta con var(--mk) por severidad). */
const BARS = '<span class="mk-bars"><i></i><i></i><i></i></span>';
export function markButton(id, level = DEFECTO){
  return '<button class="mark-btn" type="button" data-mark="' + id + '" data-level="' + level + '"'
    + ' aria-label="Importancia" title="' + levelTitle(level) + '">' + BARS + '</button>';
}

function applyLevel(btn, block, level){
  btn.setAttribute('data-level', level);
  btn.setAttribute('aria-label', 'Importancia' + (level ? ': ' + LEVEL_NAMES[level] : ''));
  btn.title = levelTitle(level);
  if(block){
    if(level) block.setAttribute('data-mark-level', level);
    else block.removeAttribute('data-mark-level');
  }
}

/* Coloca los indicadores en cada bloque marcable, aplica el estado guardado y
   delega los clics (ciclo). Idempotente: no duplica (marca con data-marked). */
export function bindMarks(root, temaId, { signal } = {}){
  registrarDeclaradas(temaId, root);
  const levels = levelsOf(temaId);
  const place = (block, host, id, where) => {
    host.insertAdjacentHTML(where, markButton(id));
    const btn = where === 'beforeend' ? host.lastElementChild : host.firstElementChild;
    applyLevel(btn, block, markLevel(temaId, id));
  };

  root.querySelectorAll('.card[data-mark-id]:not([data-marked])').forEach(c => {
    c.setAttribute('data-marked', '');
    const row = c.querySelector('.card-head .row1') || c.querySelector('.card-head');
    if(row) place(c, row, c.getAttribute('data-mark-id'), 'afterbegin');
  });
  root.querySelectorAll('.art-block[id]:not([data-marked])').forEach(a => {
    a.setAttribute('data-marked', '');
    const head = a.querySelector('.art-block-head');
    if(head) place(a, head, a.id, 'afterbegin');
  });
  root.querySelectorAll('.band[id]:not([data-marked])').forEach(b => {
    b.setAttribute('data-marked', '');
    place(b, b, b.id, 'beforeend');   // esquina sup. derecha (CSS)
  });
  /* Apartados intra-tema (cabecera .apartado-head con id): también marcables. */
  root.querySelectorAll('.apartado-head[id]:not([data-marked])').forEach(h => {
    h.setAttribute('data-marked', '');
    place(h, h, h.id, 'beforeend');   // esquina sup. derecha (CSS)
  });

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.mark-btn');
    if(!btn) return;
    e.preventDefault(); e.stopPropagation();
    const level = cycleMark(temaId, btn.getAttribute('data-mark'));
    applyLevel(btn, btn.closest('.card, .art-block, .band, .apartado-head'), level);
  }, { signal });
}

/* Nivel de importancia del TEMA entero (clave reservada `__tema__`). Se fija
   desde la vista de Plan de estudio; se muestra en la tarjeta del tema. */
const TEMA_KEY = '__tema__';
export function temaLevel(temaId){ return markLevel(temaId, TEMA_KEY); }
export function cycleTemaLevel(temaId){ return cycleMark(temaId, TEMA_KEY); }

/* Mapa EFECTIVO { id: nivel } de un tema: lo declarado por el contenido, con lo
   que el usuario haya decidido encima. Devolver ya resuelto el efectivo evita
   tener que pasar el `temaId` por las seis funciones del árbol de prioridades
   solo para poder consultar el defecto — y evita que a una se le olvide, que es
   como un nodo declarado «omitir» aparecería como baja sin que nada fallara. */
export function levelsMap(temaId){
  return { ...(DECLARADAS.get(temaId) || {}), ...levelsOf(temaId) };
}
export const TEMA_MARK_KEY = TEMA_KEY;
export const NIVEL_OMITIR = OMITIR;
export const NIVEL_DEFECTO = DEFECTO;
