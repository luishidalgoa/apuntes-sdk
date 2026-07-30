/* Índice de contenido genérico para el BUSCADOR GLOBAL.

   Aprovecha que TODAS las apps del SDK (TAI, Legislación…) renderizan sus temas
   con la MISMA estructura de contenido (bandas `.band` con `.rom`+`<h2>`,
   tarjetas `.node/.card` con `.name`+`.desc`, y el detalle en `.det`). Este
   módulo renderiza cada tema en un contenedor desmontado y recorre esa
   estructura común para producir una lista de "puntos" buscables, cada uno con
   su tema, número de esquema y un ancla para el deep-link (`#/tema/<id>/<ancla>`).

   Es 100% agnóstico de la asignatura: no sabe nada de legislación ni de TAI,
   solo del sistema de diseño compartido. El índice se construye una sola vez
   (perezoso, la 1ª búsqueda) y se cachea. */
import { allTemas, bloqueOf, materiaOf } from '../registry.js';

export function normalize(s){
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function temaNumber(t, i){
  const m = String(t.k || '').match(/\b(\d+)\b/);
  return m ? m[1] : String(i + 1);
}

let INDEX = null;

/* Indexa UN tema: lo renderiza en un contenedor DESMONTADO (nunca se añade al
   documento — el JS de renderContent funciona igual sobre DOM desconectado, pero
   así NO se cargan imágenes, NO se lanzan animaciones ni se fuerza layout) y
   recorre la estructura común devolviendo sus entradas ya normalizadas. */
function indexTema(tema, ti){
  const num = temaNumber(tema, ti);
  const mat = materiaOf(tema);               // capa de navegación "materia" (opcional)
  const matLabel = mat ? mat.label : '';
  const bl = bloqueOf(tema);                 // agrupación "bloque" DENTRO de la materia (opcional)
  const blLabel = bl ? bl.label : '';
  const crumb = [matLabel, blLabel].filter(Boolean).map(s => s + ' › ').join('');   // "Legislación › Bloque 1 › Tema 4 › …"
  const entries = [];
  const box = document.createElement('div');
  try { tema.renderContent(box); } catch(e){ return entries; }   // un tema que falle no rompe el resto

  let bandTitle = '';
  // Recorrido por ORDEN de documento: bandas (cabeceras), tarjetas (.node) y
  // artículos (.art-block). Los art-blocks se indexan como entradas propias
  // (búsqueda a nivel de artículo; su detalle vive en .arts-list, no en .det,
  // así que el bucle de cards no lo captura). `bandTitle` es correcto por orden.
  box.querySelectorAll('.band, .node, .art-block[id], .cheat').forEach((el) => {
    /* Chuletas (`.cheat`): rejillas de datos sueltos —plazos, cifras, mayorías—
       que viven FUERA de las tarjetas, así que ningún otro recorrido las veía y
       eran invisibles al buscador. Y son justo lo que se teclea: «3 meses»,
       «silencio», «mayoría absoluta». Se indexa UNA entrada por chuleta, no una
       por fila: 57 filas darían 57 resultados titulados «10 días», que es ruido
       —y ocho resultados idénticos no dicen cuál mirar—. Con el texto de todas
       sus celdas dentro, buscar cualquier dato la encuentra igual, y el
       resultado se presenta con el título de la chuleta, que sí orienta. */
    if(el.classList.contains('cheat')){
      const tEl = el.querySelector('h3, h4, .cheat-title');
      const title = clean(tEl && tEl.textContent);
      if(!title) return;
      /* Los NÚMEROS van delante, todos juntos, y las glosas después. El texto se
         recorta a 700 como el del resto, y una chuleta larga lo agota: la de
         plazos del Título I perdía «3 meses» —su última fila— y no salía al
         buscarlo, que es el caso que justifica indexarlas. Con los datos por
         delante, el recorte solo puede comerse prosa. */
      const celdas = [...el.querySelectorAll('.cell')];
      const numeros = celdas.map(c => clean((c.querySelector('.n') || {}).textContent)).filter(Boolean);
      const glosas = celdas.map(c => clean((c.querySelector('.t') || {}).textContent)).filter(Boolean);
      entries.push({
        temaId: tema.id, temaNum: num, temaK: tema.k, bloque: blLabel, kind: 'card',
        num: '',
        title,
        text: clean([numeros.join(' · '), glosas.join(' · ')].filter(Boolean).join(' — ') || el.textContent).slice(0, 700),
        anchor: el.id || (el.querySelector('[id]') || {}).id || '',
        path: crumb + 'Tema ' + num + (bandTitle ? ' › ' + bandTitle : '')
      });
      return;
    }
    if(el.classList.contains('art-block')){
      const artTitle = clean((el.querySelector('.art-title') || {}).textContent);
      if(!artTitle) return;
      const clone = el.cloneNode(true);
      clone.querySelectorAll('.art-block-head, button').forEach(x => x.remove());   // fuera nº+título del cuerpo
      entries.push({
        temaId: tema.id, temaNum: num, temaK: tema.k, bloque: blLabel, kind: 'card',
        num: clean((el.querySelector('.art-num') || {}).textContent),
        title: artTitle,
        text: clean(clone.textContent).slice(0, 700),
        anchor: el.id,
        path: crumb + 'Tema ' + num + (bandTitle ? ' › ' + bandTitle : '')
      });
      return;
    }
    if(el.classList.contains('band')){
      bandTitle = clean((el.querySelector('h2') || {}).textContent);
      const kicker = clean((el.querySelector('.k') || {}).textContent);   // suele traer la ref oficial (4.1, 4.2…)
      entries.push({
        temaId: tema.id, temaNum: num, temaK: tema.k, bloque: blLabel, kind: 'band',
        num: clean((el.querySelector('.rom') || {}).textContent),
        title: bandTitle,
        text: clean([kicker, (el.querySelector('.sub') || {}).textContent].filter(Boolean).join(' · ')),
        anchor: el.id || '',
        path: crumb + 'Tema ' + num
      });
      return;
    }
    const nameEl = el.querySelector('.name, .label');   // .label: tarjetas artesanales (leg-tema1)
    if(!nameEl) return;
    const numEl = nameEl.querySelector('.secn') || el.querySelector('.sig') || el.querySelector('.anum');
    const secn = clean(numEl && numEl.textContent);
    const title = clean(nameEl.textContent).replace(/^\s*\d+(?:\.\d+)*\s*/, '').trim() || clean(nameEl.textContent);
    const desc = el.querySelector('.desc');
    const det = el.querySelector('.det');
    const text = clean([desc && desc.textContent, det && det.textContent].filter(Boolean).join(' ')).slice(0, 700);
    const anchor = el.id || (el.querySelector('[id]') || {}).id || '';
    entries.push({
      temaId: tema.id, temaNum: num, temaK: tema.k, bloque: blLabel, kind: 'card',
      num: secn, title, text, anchor,
      path: crumb + 'Tema ' + num + (bandTitle ? ' › ' + bandTitle : '')
    });
  });

  entries.forEach(e => {
    e.materiaId = mat ? mat.id : null;   // para acotar la búsqueda a una materia
    e._t = normalize(e.title); e._x = normalize(e.text); e._n = normalize(e.num);
    e._k = normalize([matLabel, blLabel, e.temaK].filter(Boolean).join(' '));   // materia y bloque también buscables (con el nombre del tema)
    e._tw = wordsOf(e._t); e._xw = wordsOf(e._x); e._kw = wordsOf(e._k);
  });
  return entries;
}

/* Construye (y cachea) el índice completo de forma SÍNCRONA. Es el camino de
   respaldo: si el usuario busca antes de que termine el precalentado, se
   completa aquí de una vez (a costa de un instante). Normalmente el índice ya
   está listo por `warmIndex`. */
export function buildIndex(){
  if(INDEX) return INDEX;
  const temas = allTemas();
  const entries = [];
  for(let i = 0; i < temas.length; i++){
    const part = indexTema(temas[i], i);
    for(const e of part) entries.push(e);
  }
  INDEX = entries;
  return INDEX;
}

/* Precalentado NO bloqueante: indexa UN tema por hueco de inactividad, cediendo
   el hilo entre temas. Así la app nunca se congela al arrancar aunque algún
   tema renderice contenido pesado (evita bloquear ~segundos de golpe). Si una
   búsqueda dispara `buildIndex` a mitad, este se para (ya hay índice completo). */
let warming = false;
const scheduleIdle = (fn) => ('requestIdleCallback' in window)
  ? requestIdleCallback(fn, { timeout: 1200 })
  : setTimeout(fn, 32);

export function warmIndex(){
  if(INDEX || warming) return;
  warming = true;
  const temas = allTemas();
  const acc = [];
  let i = 0;
  const step = () => {
    if(INDEX){ warming = false; return; }          // una búsqueda ya construyó el índice entero
    if(i >= temas.length){ INDEX = acc; warming = false; return; }
    const part = indexTema(temas[i], i);
    for(const e of part) acc.push(e);
    i++;
    scheduleIdle(step);
  };
  scheduleIdle(step);
}

export function invalidateIndex(){ INDEX = null; warming = false; }

/* ---------- scorer: substring + prefijo + fuzzy (Jaro-Winkler) + nº de punto ----------
   Jaro-Winkler tolera erratas y transposiciones (djistrak≈dijkstra ≈0.88) y
   separa bien del ruido (palabras no relacionadas ~0.5), a diferencia de los
   bigramas. */
function jaroWinkler(s1, s2){
  if(s1 === s2) return 1;
  const l1 = s1.length, l2 = s2.length;
  if(!l1 || !l2) return 0;
  const win = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const m1 = new Array(l1).fill(false), m2 = new Array(l2).fill(false);
  let m = 0;
  for(let i = 0; i < l1; i++){
    const lo = Math.max(0, i - win), hi = Math.min(i + win + 1, l2);
    for(let j = lo; j < hi; j++){ if(!m2[j] && s1[i] === s2[j]){ m1[i] = m2[j] = true; m++; break; } }
  }
  if(!m) return 0;
  let t = 0, k = 0;
  for(let i = 0; i < l1; i++){ if(m1[i]){ while(!m2[k]) k++; if(s1[i] !== s2[k]) t++; k++; } }
  t /= 2;
  const jaro = (m / l1 + m / l2 + (m - t) / m) / 3;
  let p = 0; while(p < 4 && p < l1 && p < l2 && s1[p] === s2[p]) p++;   // prefijo común (máx 4)
  return jaro + p * 0.1 * (1 - jaro);
}
function fieldScore(field, q, terms, words){
  if(!field) return 0;
  let sc = 0;
  if(q.length >= 2 && field.includes(q)) sc += 100;         // substring exacto (normalizado)
  for(const t of terms){
    if(field.includes(t)){ sc += 34; continue; }
    if(words.some(w => w.startsWith(t) && t.length >= 3)){ sc += 22; continue; }
    if(t.length < 4) continue;
    let best = 0;                                            // fuzzy: tolerancia a erratas/transposiciones
    for(const w of words){ if(w.length >= 4 && Math.abs(w.length - t.length) <= 3){ const d = jaroWinkler(t, w); if(d > best) best = d; } }
    if(best >= 0.84) sc += Math.round((best - 0.8) / 0.2 * 60);
  }
  return sc;
}
const wordsOf = (s) => (s || '').split(/[^a-z0-9]+/).filter(Boolean);
function scoreEntry(e, q, terms){
  let sc = 0;
  if(e._n){                                                 // búsqueda por número de punto ("4.3.1", "2.5")
    if(e._n === q) sc += 320;
    else if(q.length >= 2 && e._n.startsWith(q)) sc += 130;
    else if(e._n.length >= 3 && q.startsWith(e._n)) sc += 60;
  }
  sc += fieldScore(e._t, q, terms, e._tw) * 3;              // título pesa el triple
  sc += fieldScore(e._x, q, terms, e._xw);                  // cuerpo
  sc += fieldScore(e._k, q, terms, e._kw) * 0.5;            // nombre del tema
  if(sc && e.kind === 'card') sc += 5;                      // preferencia leve por puntos concretos
  return sc;
}

/* scopeMateriaId (opcional): si se pasa, solo se buscan entradas de esa materia
   (contexto: estás dentro de una materia). Sin él, busca en todo el temario. */
export function searchContent(query, limit = 30, scopeMateriaId = null){
  const q = normalize(query);
  if(q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const out = [];
  for(const e of buildIndex()){
    if(scopeMateriaId && e.materiaId !== scopeMateriaId) continue;
    const s = scoreEntry(e, q, terms);
    if(s > 0) out.push({ e, s });
  }
  out.sort((a, b) => b.s - a.s || a.e.title.length - b.e.title.length);
  return out.slice(0, limit).map(r => r.e);
}
