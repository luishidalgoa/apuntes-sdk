/* Examen como OVERLAY (SPA): abre encima de la vista actual sin cambiar de ruta,
   así al cerrar vuelves EXACTAMENTE donde ibas. Banco de preguntas acotado por
   MATERIA cuando se abre desde una materia (o un tema suyo); global desde la
   portada. Reanuda donde lo dejaste mientras no cambie la materia ("Nuevo
   examen" reinicia). Temporizador opcional, asistente IA y vista previa del
   temario (drawer/sheet) sin salir del examen. */
import { allTemas, temasOfMateria, bloqueOf, hasBloques, materiaOf, hasMaterias } from '../registry.js';
import { config } from '../config.js';
import { renderAiPanel } from '../exam/ai.js';
import { openRefPreview } from '../exam/preview.js';
import { registerLayer } from '../core/modal-stack.js';

const EXAM_TIME_LIMIT = 45;

/* "Apartado" = sección del examen DENTRO de un tema (cada PDF de teoría). Es el
   nivel inferior a Materia › Bloque › Tema. Retrocompatible: si un tema/pregunta
   aún usa el nombre antiguo (`bloques`/`bloque`) se acepta igual.
   OJO: no confundir con el "bloque" que AGRUPA temas (bloqueOf). */
const apartadosDe = (t) => t.apartados || t.bloques || [];
const apartadoDe  = (q) => (q.apartado != null ? q.apartado : q.bloque);

let overlay = null, sheet = null, examBody = null, titleEl = null;
let examState = null;
let examTimer = null;
let QUESTIONS = [];
let TEMA_GROUPS = [];   // [{ id, label, apartados:[...] }] — solo apartados con preguntas
let currentScope;       // materiaId (string) | null (global) | undefined (nunca abierto)

function clearExamTimer(){ if(examTimer){ clearInterval(examTimer); examTimer = null; } }

/* Agrega las preguntas del ámbito (una materia o todo) y sus grupos de temas. */
function buildScope(materiaId){
  const temas = materiaId ? temasOfMateria(materiaId) : allTemas();
  QUESTIONS = temas.flatMap(t => t.questions.map(q => ({ ...q, temaId: t.id })));
  TEMA_GROUPS = temas.map(t => {
    const num = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1];
    return { id: t.id, label: num ? ('Tema ' + num + ' · ' + t.titulo) : (t.titulo || t.id),
      materia: materiaOf(t),
      bloque: bloqueOf(t),
      apartados: apartadosDe(t).filter(b => QUESTIONS.some(q => apartadoDe(q) === b)) };
  }).filter(g => g.apartados.length);
}

/* initialTema: al abrir desde un tema, se preseleccionan solo sus apartados. */
function showExamSetup(initialTema){
  clearExamTimer();
  const esc = s => String(s).replace(/"/g, '&quot;');
  const countApartado = (b) => QUESTIONS.filter(q => apartadoDe(q) === b).length;
  const countTema = (g) => g.apartados.reduce((s, b) => s + countApartado(b), 0);
  const hasInitial = initialTema && TEMA_GROUPS.some(g => g.id === initialTema);
  const total = QUESTIONS.length;

  let idx = 0;
  const temaGroupHtml = (g) => {
    const on = !hasInitial || g.id === initialTema;
    const rows = g.apartados.map(b => {
      const id = 'exb' + (idx++);
      return '<div class="exam-apartado-row"><input type="checkbox" class="exam-apartado-cb" id="' + id + '" data-tema="' + esc(g.id) + '" data-apartado="' + esc(b) + '"' + (on ? ' checked' : '') + '/>'
        + '<label for="' + id + '">' + b + '</label><span class="exam-tema-count">' + countApartado(b) + '</span></div>';
    }).join('');
    return '<div class="exam-tema-group" data-tema="' + esc(g.id) + '">'
      + '<div class="exam-tema-row exam-tema-head">'
      +   '<input type="checkbox" class="exam-tema-cb" data-tema="' + esc(g.id) + '"' + (on ? ' checked' : '') + '/>'
      +   '<label>' + g.label + '</label>'
      +   '<span class="exam-tema-count">' + countTema(g) + '</span>'
      +   '<button class="exam-tema-toggle" type="button" aria-expanded="false" aria-label="Ver apartados del tema">▸</button>'
      + '</div>'
      + '<div class="exam-apartados" hidden>' + rows + '</div>'
      + '</div>';
  };

  /* Agrupación por la capa ACTIVA: MATERIA (si la app tiene materias) o BLOQUE.
     Cuando el examen está ACOTADO a una sola materia, no tiene sentido repetir
     su cabecera: se listan los temas directamente. */
  const scopedToMateria = currentScope != null;
  const useGroups = !scopedToMateria && (hasMaterias() || hasBloques());
  const grupoDe = (g) => hasMaterias() ? g.materia : g.bloque;
  let groupsHtml;
  if(useGroups){
    const blocks = []; const byId = new Map();
    TEMA_GROUPS.forEach(g => {
      const gr = grupoDe(g);
      const key = gr ? gr.id : ' ';
      let bg = byId.get(key);
      if(!bg){ bg = { id: gr ? gr.id : null, label: gr ? gr.label : null, temas: [] }; byId.set(key, bg); blocks.push(bg); }
      bg.temas.push(g);
    });
    groupsHtml = blocks.map(bg => {
      const inner = bg.temas.map(temaGroupHtml).join('');
      if(!bg.label) return inner;
      const on = !hasInitial || bg.temas.some(g => g.id === initialTema);
      const cnt = bg.temas.reduce((s, g) => s + countTema(g), 0);
      return '<div class="exam-bloque-group" data-bloque-id="' + esc(bg.id) + '">'
        + '<div class="exam-tema-row exam-bloque-head">'
        +   '<input type="checkbox" class="exam-bloqueg-cb" data-bloque-id="' + esc(bg.id) + '"' + (on ? ' checked' : '') + '/>'
        +   '<label>' + bg.label + '</label>'
        +   '<span class="exam-tema-count">' + cnt + '</span>'
        + '</div>'
        + inner
        + '</div>';
    }).join('');
  } else {
    groupsHtml = TEMA_GROUPS.map(temaGroupHtml).join('');
  }
  const selCount = hasInitial ? countTema(TEMA_GROUPS.find(g => g.id === initialTema)) : total;

  examBody.innerHTML =
    '<div class="exam-setup">'
    + '<p class="exam-setup-label">¿De qué temas quieres examinarte?</p>'
    + '<div class="exam-temas">'
    + '<div class="exam-tema-row exam-tema-all"><input type="checkbox" id="examTemaAll"' + (!hasInitial ? ' checked' : '') + '/><label for="examTemaAll">Todos los temas</label><span class="exam-tema-count">' + total + '</span></div>'
    + groupsHtml
    + '</div>'
    + '<p class="exam-setup-warn" id="examSetupWarn" style="display:none">Selecciona al menos un apartado.</p>'
    + '<p class="exam-setup-label">¿Con temporizador?</p>'
    + '<div class="opts exam-time-opts"><button class="btn" data-timed="0">Sin temporizador</button><button class="btn" data-timed="1">⏱ Con temporizador (45s/pregunta)</button></div>'
    + '<p class="exam-setup-label">¿Cuántas preguntas?</p>'
    + '<div class="opts"><button class="btn" data-n="10">10</button><button class="btn" data-n="20">20</button><button class="btn" data-n="0">Todas (<span id="examPoolCount">' + selCount + '</span>)</button></div>'
    + '</div>';

  const allCb = examBody.querySelector('#examTemaAll');
  const temaCbs = [...examBody.querySelectorAll('.exam-tema-cb')];
  const apartadoCbs = [...examBody.querySelectorAll('.exam-apartado-cb')];
  const bloquegCbs = [...examBody.querySelectorAll('.exam-bloqueg-cb')];
  const poolCountEl = examBody.querySelector('#examPoolCount');
  const warnEl = examBody.querySelector('#examSetupWarn');
  let timedChoice = false;

  const seleccionados = () => apartadoCbs.filter(c => c.checked).map(c => c.getAttribute('data-apartado'));
  const apartadosOf = (id) => apartadoCbs.filter(c => c.getAttribute('data-tema') === id);
  const bloqueGOf = (temaId) => { const g = TEMA_GROUPS.find(x => x.id === temaId); const gr = g && grupoDe(g); return gr ? gr.id : null; };
  const temaIdsOfBloqueG = (bid) => TEMA_GROUPS.filter(g => { const gr = grupoDe(g); return (gr ? gr.id : null) === bid; }).map(g => g.id);
  const temaCbsOfBloqueG = (bid) => { const ids = temaIdsOfBloqueG(bid); return temaCbs.filter(c => ids.includes(c.getAttribute('data-tema'))); };
  const apartadoCbsOfBloqueG = (bid) => { const ids = temaIdsOfBloqueG(bid); return apartadoCbs.filter(c => ids.includes(c.getAttribute('data-tema'))); };
  function syncBloqueG(bid){
    if(bid == null) return;
    const bg = bloquegCbs.find(c => c.getAttribute('data-bloque-id') === bid);
    if(!bg) return;
    const cbs = apartadoCbsOfBloqueG(bid), on = cbs.filter(c => c.checked).length;
    bg.checked = on === cbs.length; bg.indeterminate = on > 0 && on < cbs.length;
  }
  function syncTema(id){
    const cbs = apartadosOf(id), t = temaCbs.find(c => c.getAttribute('data-tema') === id);
    const on = cbs.filter(c => c.checked).length;
    t.checked = on === cbs.length; t.indeterminate = on > 0 && on < cbs.length;
    syncBloqueG(bloqueGOf(id));
  }
  function syncAll(){
    const on = apartadoCbs.filter(c => c.checked).length;
    allCb.checked = on === apartadoCbs.length; allCb.indeterminate = on > 0 && on < apartadoCbs.length;
  }
  function updatePoolCount(){ const sel = seleccionados(); poolCountEl.textContent = QUESTIONS.filter(q => sel.includes(apartadoDe(q))).length; }

  TEMA_GROUPS.forEach(g => syncTema(g.id)); syncAll();
  allCb.addEventListener('change', () => {
    apartadoCbs.forEach(c => c.checked = allCb.checked);
    temaCbs.forEach(c => { c.checked = allCb.checked; c.indeterminate = false; });
    bloquegCbs.forEach(c => { c.checked = allCb.checked; c.indeterminate = false; });
    updatePoolCount();
  });
  bloquegCbs.forEach(bg => bg.addEventListener('change', () => {
    const bid = bg.getAttribute('data-bloque-id');
    apartadoCbsOfBloqueG(bid).forEach(c => c.checked = bg.checked);
    temaCbsOfBloqueG(bid).forEach(c => { c.checked = bg.checked; c.indeterminate = false; });
    bg.indeterminate = false; syncAll(); updatePoolCount();
  }));
  temaCbs.forEach(t => t.addEventListener('change', () => {
    apartadosOf(t.getAttribute('data-tema')).forEach(c => c.checked = t.checked);
    t.indeterminate = false; syncBloqueG(bloqueGOf(t.getAttribute('data-tema'))); syncAll(); updatePoolCount();
  }));
  apartadoCbs.forEach(c => c.addEventListener('change', () => { syncTema(c.getAttribute('data-tema')); syncAll(); updatePoolCount(); }));
  examBody.querySelectorAll('.exam-tema-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = btn.closest('.exam-tema-group').querySelector('.exam-apartados');
      const open = box.hidden; box.hidden = !open;
      btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('open', open);
    });
  });

  const timeBtns = [...examBody.querySelectorAll('.exam-time-opts button')];
  timeBtns[0].classList.add('on');
  timeBtns.forEach(b => b.addEventListener('click', () => {
    timeBtns.forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    timedChoice = b.getAttribute('data-timed') === '1';
  }));
  examBody.querySelectorAll('.exam-setup > .opts:not(.exam-time-opts) button').forEach(b => {
    b.addEventListener('click', () => {
      const sel = seleccionados();
      if(!sel.length){ warnEl.style.display = 'block'; return; }
      startExam(parseInt(b.getAttribute('data-n'), 10) || null, sel, timedChoice);
    });
  });
  syncNewBtn();
}

function shuffled(arr){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function startExam(n, apartados, timed){
  let pool = QUESTIONS.filter(q => apartados.includes(apartadoDe(q)));
  pool = shuffled(pool);
  if(n) pool = pool.slice(0, n);
  examState = { pool, index: 0, score: 0, wrongList: [], timed: !!timed };
  renderExamQuestion();
  syncNewBtn();
}

function renderExamQuestion(){
  clearExamTimer();
  const { pool, index, score, timed } = examState;
  const q = pool[index];
  examState.currentOpts = shuffled(q.respuestas);
  examBody.innerHTML =
    '<div class="exam-progress"><span>Pregunta ' + (index + 1) + ' de ' + pool.length + ' · ' + apartadoDe(q) + '</span><span>Aciertos: ' + score + '</span></div>'
    + (timed ? '<div class="exam-timer"><div class="exam-timer-track"><div class="exam-timer-fill" id="examTimerBar"></div></div><span class="exam-timer-n" id="examTimerN">' + EXAM_TIME_LIMIT + 's</span></div>' : '')
    + '<div class="exam-q">' + q.pregunta + '</div>'
    + '<div class="exam-opts">' + examState.currentOpts.map((r, i) => '<button class="exam-opt" data-i="' + i + '">' + r + '</button>').join('') + '</div>'
    + '<div class="exam-feedback" style="display:none"></div>';
  examBody.querySelectorAll('.exam-opt').forEach(btn => {
    btn.addEventListener('click', () => onExamAnswer(parseInt(btn.getAttribute('data-i'), 10)));
  });
  if(timed){
    let remaining = EXAM_TIME_LIMIT;
    const bar = examBody.querySelector('#examTimerBar');
    const numEl = examBody.querySelector('#examTimerN');
    examTimer = setInterval(() => {
      remaining--;
      numEl.textContent = remaining + 's';
      bar.style.width = (remaining / EXAM_TIME_LIMIT * 100) + '%';
      if(remaining <= 10) bar.classList.add('low');
      if(remaining <= 0){ clearExamTimer(); onExamAnswer(-1); }
    }, 1000);
  }
}

function onExamAnswer(i){
  clearExamTimer();
  const { pool, index } = examState;
  const q = pool[index];
  const optTexts = examState.currentOpts;
  const correctIndex = optTexts.indexOf(q.correcta);
  const opts = examBody.querySelectorAll('.exam-opt');
  opts.forEach((btn, idx) => {
    btn.disabled = true;
    if(idx === correctIndex) btn.classList.add('correct');
    else if(idx === i) btn.classList.add('incorrect');
  });
  const isCorrect = i === correctIndex;
  if(isCorrect) examState.score++;
  else examState.wrongList.push(q);
  const fb = examBody.querySelector('.exam-feedback');
  fb.style.display = 'block';
  fb.innerHTML =
    '<p class="exam-result ' + (isCorrect ? 'ok' : 'bad') + '">' + (i === -1 ? '⏱ Tiempo agotado' : (isCorrect ? '✓ Correcto' : '✗ Incorrecto')) + '</p>'
    + (q.explicacion ? '<p class="exam-explain">' + q.explicacion + '</p>' : '')
    + '<div class="exam-actions">'
    + (q.articulo ? '<button class="btn small" type="button" id="examRefBtn">→ Ver en el temario</button>' : '')
    + '<button class="btn small" id="examAskBtn">💬 Preguntar dudas</button>'
    + '<button class="btn small on" id="examNextBtn">' + (index + 1 < pool.length ? 'Siguiente' : 'Ver resultado') + '</button>'
    + '</div><div class="exam-ai" id="examAi" style="display:none"></div>';
  const refBtn = fb.querySelector('#examRefBtn');
  if(refBtn) refBtn.addEventListener('click', () => openRefPreview(q));
  const userAnswer = i === -1 ? null : optTexts[i];
  fb.querySelector('#examAskBtn').addEventListener('click', () => {
    const aiBox = fb.querySelector('#examAi');
    const willShow = aiBox.style.display === 'none';
    aiBox.style.display = willShow ? 'block' : 'none';
    if(willShow && !aiBox.dataset.rendered){ renderAiPanel(aiBox, q, userAnswer); aiBox.dataset.rendered = '1'; }
  });
  fb.querySelector('#examNextBtn').addEventListener('click', nextExamQuestion);
}

function nextExamQuestion(){
  examState.index++;
  if(examState.index >= examState.pool.length) renderExamResults();
  else renderExamQuestion();
}

function renderExamResults(){
  clearExamTimer();
  const { score, pool, wrongList } = examState;
  examBody.innerHTML =
    '<div class="exam-results">'
    + '<p class="exam-score">' + score + ' / ' + pool.length + ' correctas</p>'
    + (wrongList.length
        ? '<p class="exam-wrong-head">Para repasar:</p><ul class="exam-wrong-list">' + wrongList.map((q, wi) =>
            '<li>' + q.pregunta + ' → <b>' + q.correcta + '</b>' + (q.articulo ? ' <button class="btn small" type="button" data-wrong-idx="' + wi + '">→ art. ' + q.articulo + '</button>' : '') + '</li>'
          ).join('') + '</ul>'
        : '<p>¡Sin fallos!</p>')
    + '<div class="exam-results-actions"><button class="btn on" id="examRestartBtn">Repetir examen</button></div></div>';
  examBody.querySelector('#examRestartBtn').addEventListener('click', () => { examState = null; showExamSetup(null); });
  examBody.querySelectorAll('[data-wrong-idx]').forEach(btn => {
    btn.addEventListener('click', () => openRefPreview(wrongList[parseInt(btn.getAttribute('data-wrong-idx'), 10)]));
  });
}

/* "Nuevo examen" solo tiene sentido cuando hay un examen/resultado en curso. */
function syncNewBtn(){
  if(!overlay) return;
  const btn = overlay.querySelector('#examNewBtn');
  if(btn) btn.hidden = !examState;
}

/* ---------- overlay: montaje, apertura (con ámbito) y cierre ---------- */
export function mountExamOverlay(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="examOverlay" role="dialog" aria-modal="true" aria-label="Examen">
  <div class="exam-sheet">
    <button class="exam-sheet-grip" type="button" aria-label="Arrastra para cerrar"></button>
    <div class="exam-sheet-head">
      <span class="exam-sheet-title" id="examSheetTitle">Examen</span>
      <button class="btn small exam-new" type="button" id="examNewBtn" hidden>Nuevo examen</button>
      <button class="exam-sheet-close" type="button" aria-label="Cerrar examen">✕</button>
    </div>
    <div class="exam-body" id="examBody"></div>
  </div>
</div>`);
  overlay = shell.querySelector('#examOverlay');
  sheet = overlay.querySelector('.exam-sheet');
  examBody = overlay.querySelector('#examBody');
  titleEl = overlay.querySelector('#examSheetTitle');
  overlay.querySelector('.exam-sheet-close').addEventListener('click', closeExam);
  overlay.addEventListener('click', (e) => { if(e.target === overlay) closeExam(); });
  overlay.querySelector('#examNewBtn').addEventListener('click', () => { clearExamTimer(); examState = null; showExamSetup(null); });
  installSheetDrag(overlay.querySelector('.exam-sheet-grip'), sheet);
  registerLayer({ isOpen: () => overlay.classList.contains('open'), close: closeExam, priority: 30 });
}

/* context: { materiaId?, temaId? }. Reanuda si la materia no cambia y hay
   examen en curso; si cambia el ámbito (o es la 1ª vez), arranca en setup. */
export function openExam(context = {}){
  if(!overlay) return;
  const materiaId = context.materiaId || null;
  if(currentScope === undefined || materiaId !== currentScope){
    buildScope(materiaId);
    currentScope = materiaId;
    examState = null;
    showExamSetup(context.temaId || null);
  } else if(!examState){
    showExamSetup(context.temaId || null);
  }
  // mismo ámbito + examen en curso → reanudar (se conserva el cuerpo)
  const mat = materiaId ? materiaOf({ materia: materiaId }) : null;
  titleEl.textContent = mat ? ('Examen · ' + mat.label) : 'Examen';
  syncNewBtn();
  sheet.style.transform = '';
  overlay.classList.add('open');
}

export function closeExam(){
  clearExamTimer();   // pausa el temporizador mientras está oculto
  overlay.classList.remove('open');
  sheet.style.transform = '';
}

/* Bottom-sheet arrastrable en móvil (en escritorio el grip está oculto): tirar
   del grip y soltar tras un desplazamiento vertical claro cierra; si no, vuelve. */
function installSheetDrag(grip, card){
  if(!grip) return;
  let startY = 0, dy = 0, dragging = false;
  const onDown = (e) => { dragging = true; startY = e.clientY; dy = 0; card.style.transition = 'none'; try{ grip.setPointerCapture(e.pointerId); }catch(_){ } };
  const onMove = (e) => {
    if(!dragging) return;
    dy = e.clientY - startY;
    const shown = dy >= 0 ? dy : -Math.min(48, Math.log1p(-dy) * 20);
    card.style.transform = 'translateY(' + shown + 'px)';
  };
  const onUp = (e) => {
    if(!dragging) return;
    dragging = false;
    card.style.transition = '';
    try{ grip.releasePointerCapture(e.pointerId); }catch(_){ }
    if(Math.abs(dy) > 90){ closeExam(); }
    else { card.style.transform = ''; }
  };
  grip.addEventListener('pointerdown', onDown);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onUp);
  grip.addEventListener('click', (e) => e.preventDefault());
}
