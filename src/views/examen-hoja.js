/* Vista HOJA de un examen oficial: el cuadernillo entero en scroll vertical.

   La vista pregunta-a-pregunta del banco sirve para estudiar; ésta sirve para
   ensayar el examen, y por eso imita el papel: ves cuántas te quedan, saltas a
   la 73 porque recuerdas que la dejaste, vuelves atrás. Nada de eso existe
   cuando solo ves una pregunta.

   Tres decisiones que vienen del formato real y no del capricho:
     · Se responde sin feedback. Corriges al final, como en la oposición: saber
       al momento si acertaste cambia cómo respondes las siguientes.
     · «Dudosa» es marca del que examina, no del corrector — en el papel se
       rodea el número para volver. Va aparte de la respuesta.
     · Sin plantilla NO se corrige. Se dice y se ofrece la hoja igualmente;
       corregir a ciegas daría un cero que parece una nota.
*/

import { corregir } from '../core/examen-oficial.js';
import { openRefPreview, questionRefs, refLabel } from '../exam/preview.js';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LETRAS = ['a', 'b', 'c', 'd', 'e', 'f'];

/* Plural simple: «1 acierto» / «2 aciertos». Un contador que dice «1 aciertos»
   se lee como descuido y resta credibilidad a la nota que hay al lado. */
function plural(n, sing, plu){ return n + ' ' + (n === 1 ? sing : (plu || sing + 's')); }

/* «1/3» en vez de «0.3333»: el criterio oficial se expresa en fracción y así se
   reconoce al leerlo en la convocatoria. */
function fraccion(p){
  const inv = 1 / p;
  return Number.isInteger(Math.round(inv * 1000) / 1000) || Math.abs(inv - Math.round(inv)) < 1e-9
    ? '1/' + Math.round(inv) : String(p);
}

function mmss(seg){
  const m = Math.floor(seg / 60), s = seg % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function pintarPregunta(q, marcadas, dudosas){
  const marcada = marcadas[q.n];
  const opciones = q.respuestas.map((txt, i) => {
    const on = String(marcada) === String(i);
    return '<label class="exh-op' + (on ? ' on' : '') + '">'
      + '<input type="radio" name="q' + q.n + '" value="' + i + '"' + (on ? ' checked' : '') + '/>'
      + '<span class="exh-le">' + (LETRAS[i] || (i + 1)) + ')</span>'
      + '<span class="exh-tx">' + esc(txt) + '</span>'
      + '</label>';
  }).join('');
  return '<article class="exh-q' + (q.anulada ? ' anulada' : '') + (dudosas.has(q.n) ? ' dudosa' : '') + '"'
    + ' id="exh-q' + q.n + '" data-n="' + q.n + '">'
    + '<div class="exh-cab">'
    +   '<span class="exh-n">' + q.n + '</span>'
    +   '<p class="exh-en">' + esc(q.pregunta) + '</p>'
    +   '<button class="exh-duda" type="button" data-n="' + q.n + '"'
    +     ' aria-pressed="' + (dudosas.has(q.n) ? 'true' : 'false') + '"'
    +     ' title="Marcar para revisar">🚩</button>'
    + '</div>'
    + (q.anulada ? '<p class="exh-nota">Pregunta anulada — no puntúa.</p>' : '')
    + '<div class="exh-ops">' + opciones + '</div>'
    + '</article>';
}

/* Monta la hoja dentro de `host`. Devuelve un controlador con `destroy()`. */
export function mountExamenHoja(host, examen, opts = {}){
  if(!host || !examen) return null;
  const marcadas = Object.create(null);
  const dudosas = new Set();
  let corregido = null;
  let seg = 0, timer = null;
  const ac = new AbortController();
  const { signal } = ac;

  const sinPlantilla = examen.plantilla === 'ausente';

  const avisoPlantilla = sinPlantilla
    ? '<p class="exh-aviso">Este examen todavía no tiene la <b>plantilla oficial de respuestas</b>, '
      + 'así que puede hacerse pero <b>no corregirse</b>. Las plantillas se publican aparte del cuadernillo.</p>'
    : (examen.plantilla === 'parcial'
      ? '<p class="exh-aviso">Falta' + (examen.sinPlantilla === 1 ? '' : 'n') + ' la respuesta de <b>'
        + plural(examen.sinPlantilla, 'pregunta') + '</b>: '
        + (examen.sinPlantilla === 1 ? 'quedará' : 'quedarán') + ' sin corregir.</p>'
      : '');

  /* Aviso aparte del anterior: aquí sí hay respuestas y sí se corrige, pero no
     son firmes. Va en tono distinto (no bloquea nada) y menciona las
     anulaciones porque es lo que más se mueve tras las alegaciones. */
  const avisoProvisional = examen.provisional
    ? '<p class="exh-aviso prov">Plantilla <b>provisional</b>: el plazo de alegaciones sigue abierto, '
      + 'así que alguna respuesta puede cambiar y es habitual que se anulen preguntas.</p>'
    : '';

  host.innerHTML = '<div class="exh">'
    + '<header class="exh-head">'
    +   '<div class="exh-tit"><b>' + esc(examen.titulo) + '</b>'
    +     (examen.modelo ? '<span class="exh-mod">Modelo ' + esc(examen.modelo) + '</span>' : '') + '</div>'
    +   '<div class="exh-meta">'
    +     '<span class="exh-cont"><b id="exhResp">0</b> / ' + examen.preguntas.length + '</span>'
    +     '<span class="exh-cron" id="exhCron">0:00</span>'
    +   '</div>'
    + '</header>'
    + avisoProvisional
    + avisoPlantilla
    + '<div class="exh-lista">' + examen.preguntas.map(q => pintarPregunta(q, marcadas, dudosas)).join('') + '</div>'
    + '<div class="exh-pie">'
    +   '<button class="btn" id="exhCorregir" type="button"' + (sinPlantilla ? ' disabled' : '') + '>'
    +     (sinPlantilla ? 'Sin plantilla: no se puede corregir' : 'Corregir el examen') + '</button>'
    + '</div>'
    + '<div class="exh-res" id="exhRes" hidden></div>'
    + '</div>';

  const $ = (s) => host.querySelector(s);
  const contador = $('#exhResp');

  const refrescarContador = () => { contador.textContent = Object.keys(marcadas).length; };

  // cronómetro: cuenta hacia arriba salvo que el examen declare minutos
  const cron = $('#exhCron');
  const tick = () => {
    if(!host.isConnected){ clearInterval(timer); return; }   // guarda al salir del tema
    seg++;
    if(examen.minutos){
      const resta = examen.minutos * 60 - seg;
      cron.textContent = resta <= 0 ? '¡tiempo!' : mmss(resta);
      if(resta <= 0) clearInterval(timer);
      cron.classList.toggle('apura', resta > 0 && resta < 300);
    } else cron.textContent = mmss(seg);
  };
  timer = setInterval(tick, 1000);
  if(examen.minutos) cron.textContent = mmss(examen.minutos * 60);

  host.addEventListener('change', (e) => {
    const r = e.target.closest('input[type=radio]');
    if(!r) return;
    const art = r.closest('.exh-q');
    marcadas[+art.dataset.n] = +r.value;
    art.querySelectorAll('.exh-op').forEach(l => l.classList.toggle('on', l.contains(r)));
    refrescarContador();
  }, { signal });

  host.addEventListener('click', (e) => {
    const d = e.target.closest('.exh-duda');
    if(d){
      const n = +d.dataset.n;
      if(dudosas.has(n)) dudosas.delete(n); else dudosas.add(n);
      d.setAttribute('aria-pressed', dudosas.has(n) ? 'true' : 'false');
      d.closest('.exh-q').classList.toggle('dudosa', dudosas.has(n));
      return;
    }
    if(e.target.closest('#exhCorregir')) mostrarResultado();
  }, { signal });

  function mostrarResultado(){
    corregido = corregir(examen, marcadas);
    clearInterval(timer);
    const r = corregido;
    const nota = r.nota == null ? '—' : r.nota.toFixed(2);
    const caja = $('#exhRes');
    caja.hidden = false;
    caja.innerHTML = '<h3 class="exh-res-t">Resultado</h3>'
      + '<div class="exh-marc">'
      +   '<span class="exh-m ok"><b>' + r.ok + '</b> ' + (r.ok === 1 ? 'acierto' : 'aciertos') + '</span>'
      +   '<span class="exh-m mal"><b>' + r.mal + '</b> ' + (r.mal === 1 ? 'fallo' : 'fallos') + '</span>'
      +   '<span class="exh-m bl"><b>' + r.blanco + '</b> en blanco'
      +     (r.penaliza ? ' <i>· no penalizan</i>' : '') + '</span>'
      +   (r.anuladas ? '<span class="exh-m an"><b>' + r.anuladas + '</b> ' + (r.anuladas === 1 ? 'anulada' : 'anuladas') + '</span>' : '')
      +   (r.sinDato ? '<span class="exh-m sd"><b>' + r.sinDato + '</b> sin plantilla</span>' : '')
      + '</div>'
      + (r.penaliza
        ? '<p class="exh-formula">Puntuación directa <b>' + r.directa.toFixed(2) + '</b> '
          + '<span class="exh-cuenta">= ' + r.ok + ' aciertos − ' + r.mal + '/' + Math.round(1 / r.penaliza)
          + ' (' + r.descuento.toFixed(2) + ' de descuento)</span></p>'
          + '<p class="exh-consejo">Cada fallo descuenta <b>' + fraccion(r.penaliza) + '</b> de acierto, '
          + 'así que contestar al azar entre cuatro opciones no compensa: '
          + '<b>dejar en blanco es una decisión, no una renuncia.</b></p>'
        /* Sin penalización verificada la nota sale MÁS ALTA que la real y no es
           comparable con la de un examen que sí la declara. Decirlo aquí, junto
           al número, es lo único que evita que se lea como una nota buena. */
        /* En un SIMULACRO no hay criterio oficial que verificar, asi que hablar
           de «sin verificar» inventaria una deuda inexistente y de paso daria a
           entender que el examen es oficial. Lo que si sigue siendo cierto —y es
           lo que importa al leer la nota— es que no es comparable con la de una
           convocatoria que si descuenta. */
        : (examen.tipo === 'simulacro'
          ? '<p class="exh-consejo aviso">Este simulacro corrige <b>sin descuento por error</b>. '
            + 'La nota <b>no es comparable</b> con la de una convocatoria que penaliza los fallos: '
            + 'ahí, contestar al azar entre cuatro opciones no suma nada.</p>'
          : '<p class="exh-consejo aviso">Este examen corrige <b>sin descuento por error</b> '
            + 'porque su criterio de penalización no está verificado. La nota sale '
            + '<b>más alta que la real</b> y no es comparable con la de los exámenes que sí lo declaran.</p>'))
      + '<p class="exh-nota-fin">Sobre ' + plural(r.corregibles, 'pregunta') + ' corregible'
      + (r.corregibles === 1 ? '' : 's') + ' · <b>' + nota + '</b> / 10'
      + (r.anuladas ? ' · las anuladas no cuentan' : '') + '</p>'
      + '<p class="exh-tiempo">Tiempo empleado: <b>' + mmss(seg) + '</b></p>';
    // pintar cada pregunta con su veredicto
    for(const d of r.detalle){
      const art = host.querySelector('#exh-q' + d.n);
      if(!art) continue;
      art.classList.add('corr', 'c-' + d.estado);
      if(d.estado === 'mal' || d.estado === 'blanco'){
        const buena = art.querySelectorAll('.exh-op')[d.correcta];
        if(buena) buena.classList.add('era');
      }
      /* La explicacion y el enlace al temario salen AL CORREGIR, nunca antes:
         durante el examen serian la respuesta a un clic de distancia, y lo que
         se ensaya aqui es justo hacerlo sin ayuda. Van tambien en las acertadas
         —acertar por eliminacion no es saber por que— y en las que no tienen
         plantilla, donde la explicacion es lo unico que queda. */
      const q = examen.preguntas.find(x => x.n === d.n);
      const refs = q ? questionRefs(q) : [];
      if(q && (q.explicacion || refs.length)){
        const pie = document.createElement('div');
        pie.className = 'exh-tras';
        pie.innerHTML = (q.explicacion ? '<p class="exh-expl">' + esc(q.explicacion) + '</p>' : '')
          + (refs.length ? '<div class="exh-acc">' + refs.map((r, i) =>
            '<button class="btn small exh-ref" type="button" data-n="' + d.n + '" data-ref-i="' + i + '"'
            + (r.nota ? ' title="' + esc(r.nota) + '"' : '') + '>→ '
            + (refs.length > 1 ? esc(refLabel(r.ref)) : 'Ver en el temario') + '</button>').join('')
            + '</div>' : '');
        art.appendChild(pie);
      }
    }
    host.querySelectorAll('.exh-ref').forEach(b => b.addEventListener('click', () => {
      const q = examen.preguntas.find(x => String(x.n) === b.getAttribute('data-n'));
      if(q) openRefPreview(q, parseInt(b.getAttribute('data-ref-i') || '0', 10));
    }, { signal: ac.signal }));
    host.querySelectorAll('input[type=radio]').forEach(i => { i.disabled = true; });
    caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if(typeof opts.onCorregido === 'function') opts.onCorregido(r);
  }

  return {
    destroy(){ clearInterval(timer); ac.abort(); host.innerHTML = ''; },
    get resultado(){ return corregido; }
  };
}
