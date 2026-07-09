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
import { allTemas } from '../registry.js';

export function normalize(s){
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function temaNumber(t, i){
  const m = String(t.k || '').match(/\b(\d+)\b/);
  return m ? m[1] : String(i + 1);
}

let INDEX = null;

/* Construye (y cachea) el índice recorriendo la estructura de cada tema. */
export function buildIndex(){
  if(INDEX) return INDEX;
  const entries = [];

  allTemas().forEach((tema, ti) => {
    const num = temaNumber(tema, ti);
    /* Contenedor DESMONTADO (nunca se añade al documento): el JS de
       renderContent (innerHTML, numeración, ids, mounts) funciona igual sobre
       DOM desconectado, pero así NO se cargan imágenes, NO se lanzan animaciones
       ni se fuerza layout → indexar es barato y no bloquea. */
    const box = document.createElement('div');
    try { tema.renderContent(box); } catch(e){ /* un tema que falle no rompe el resto */ }

    let bandTitle = '';
    box.querySelectorAll('.band, .node').forEach((el) => {
      if(el.classList.contains('band')){
        bandTitle = clean((el.querySelector('h2') || {}).textContent);
        const kicker = clean((el.querySelector('.k') || {}).textContent);   // suele traer la ref oficial (4.1, 4.2…)
        entries.push({
          temaId: tema.id, temaNum: num, temaK: tema.k, kind: 'band',
          num: clean((el.querySelector('.rom') || {}).textContent),
          title: bandTitle,
          text: clean([kicker, (el.querySelector('.sub') || {}).textContent].filter(Boolean).join(' · ')),
          anchor: el.id || '',
          path: 'Tema ' + num
        });
        return;
      }
      const nameEl = el.querySelector('.name');
      if(!nameEl) return;
      const numEl = nameEl.querySelector('.secn') || el.querySelector('.sig') || el.querySelector('.anum');
      const secn = clean(numEl && numEl.textContent);
      const title = clean(nameEl.textContent).replace(/^\s*\d+(?:\.\d+)*\s*/, '').trim() || clean(nameEl.textContent);
      const desc = el.querySelector('.desc');
      const det = el.querySelector('.det');
      const text = clean([desc && desc.textContent, det && det.textContent].filter(Boolean).join(' ')).slice(0, 700);
      const anchor = el.id || (el.querySelector('[id]') || {}).id || '';
      entries.push({
        temaId: tema.id, temaNum: num, temaK: tema.k, kind: 'card',
        num: secn, title, text, anchor,
        path: 'Tema ' + num + (bandTitle ? ' › ' + bandTitle : '')
      });
    });
  });

  entries.forEach(e => {
    e._t = normalize(e.title); e._x = normalize(e.text); e._n = normalize(e.num); e._k = normalize(e.temaK);
    e._tw = wordsOf(e._t); e._xw = wordsOf(e._x); e._kw = wordsOf(e._k);
  });
  INDEX = entries;
  return INDEX;
}

export function invalidateIndex(){ INDEX = null; }

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

export function searchContent(query, limit = 30){
  const q = normalize(query);
  if(q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const out = [];
  for(const e of buildIndex()){
    const s = scoreEntry(e, q, terms);
    if(s > 0) out.push({ e, s });
  }
  out.sort((a, b) => b.s - a.s || a.e.title.length - b.e.title.length);
  return out.slice(0, limit).map(r => r.e);
}
