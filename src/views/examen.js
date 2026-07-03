/* Vista Examen: banco único agregado de TODOS los temas del registry,
   filtrable por bloque (título de la CE), con temporizador opcional,
   asistente IA y vista previa del temario sin salir del examen. */
import { allTemas } from '../registry.js';
import { config } from '../config.js';
import { renderAiPanel } from '../exam/ai.js';
import { openRefPreview } from '../exam/preview.js';

const EXAM_TIME_LIMIT = 45;

export const examenViewFactory = {
  create(){
    let examBody = null;
    let examState = null;
    let examTimer = null;
    let ac = null;
    /* Agregación (se calcula al montar, cuando el registry ya está poblado):
       cada pregunta conoce su tema de origen. */
    let QUESTIONS = [];
    let BLOQUE_ORDER = [];

    function clearExamTimer(){ if(examTimer){ clearInterval(examTimer); examTimer = null; } }

    function showExamSetup(){
      clearExamTimer();
      const bloques = BLOQUE_ORDER.filter(b => QUESTIONS.some(q => q.bloque === b));
      const countFor = (b) => QUESTIONS.filter(q => q.bloque === b).length;
      examBody.innerHTML =
        '<div class="exam-setup">'
        + '<p class="exam-setup-label">¿Qué bloques quieres incluir?</p>'
        + '<div class="exam-temas">'
        + '<div class="exam-tema-row exam-tema-all"><input type="checkbox" id="examTemaAll" checked/><label for="examTemaAll">Todos los bloques</label></div>'
        + bloques.map((b, i) =>
            '<div class="exam-tema-row"><input type="checkbox" class="exam-tema-cb" id="examTema' + i + '" data-bloque="' + b.replace(/"/g, '&quot;') + '" checked/>'
            + '<label for="examTema' + i + '">' + b + '</label><span class="exam-tema-count">' + countFor(b) + '</span></div>'
          ).join('')
        + '</div>'
        + '<p class="exam-setup-warn" id="examSetupWarn" style="display:none">Selecciona al menos un bloque.</p>'
        + '<p class="exam-setup-label">¿Con temporizador?</p>'
        + '<div class="opts exam-time-opts"><button class="btn" data-timed="0">Sin temporizador</button><button class="btn" data-timed="1">⏱ Con temporizador (45s/pregunta)</button></div>'
        + '<p class="exam-setup-label">¿Cuántas preguntas?</p>'
        + '<div class="opts"><button class="btn" data-n="10">10</button><button class="btn" data-n="20">20</button><button class="btn" data-n="0">Todas (<span id="examPoolCount">' + QUESTIONS.length + '</span>)</button></div>'
        + '</div>';
      const allCb = examBody.querySelector('#examTemaAll');
      const temaCbs = [...examBody.querySelectorAll('.exam-tema-cb')];
      const poolCountEl = examBody.querySelector('#examPoolCount');
      const warnEl = examBody.querySelector('#examSetupWarn');
      let timedChoice = false;
      function seleccionados(){ return temaCbs.filter(cb => cb.checked).map(cb => cb.getAttribute('data-bloque')); }
      function updatePoolCount(){ poolCountEl.textContent = QUESTIONS.filter(q => seleccionados().includes(q.bloque)).length; }
      allCb.addEventListener('change', () => { temaCbs.forEach(cb => cb.checked = allCb.checked); updatePoolCount(); });
      temaCbs.forEach(cb => cb.addEventListener('change', () => { allCb.checked = temaCbs.every(c => c.checked); updatePoolCount(); }));
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
    }

    function startExam(n, bloques, timed){
      let pool = QUESTIONS.filter(q => bloques.includes(q.bloque));
      for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      if(n) pool = pool.slice(0, n);
      examState = { pool, index: 0, score: 0, wrongList: [], timed: !!timed };
      renderExamQuestion();
    }

    function renderExamQuestion(){
      clearExamTimer();
      const { pool, index, score, timed } = examState;
      const q = pool[index];
      examBody.innerHTML =
        '<div class="exam-progress"><span>Pregunta ' + (index + 1) + ' de ' + pool.length + ' · ' + q.bloque + '</span><span>Aciertos: ' + score + '</span></div>'
        + (timed ? '<div class="exam-timer"><div class="exam-timer-track"><div class="exam-timer-fill" id="examTimerBar"></div></div><span class="exam-timer-n" id="examTimerN">' + EXAM_TIME_LIMIT + 's</span></div>' : '')
        + '<div class="exam-q">' + q.pregunta + '</div>'
        + '<div class="exam-opts">' + q.respuestas.map((r, i) => '<button class="exam-opt" data-i="' + i + '">' + r + '</button>').join('') + '</div>'
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
      const correctIndex = q.respuestas.indexOf(q.correcta);
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
      const userAnswer = i === -1 ? null : q.respuestas[i];
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
      const { pool, score, wrongList } = examState;
      examBody.innerHTML =
        '<div class="exam-results">'
        + '<p class="exam-score">' + score + ' / ' + pool.length + ' correctas</p>'
        + (wrongList.length
            ? '<p class="exam-wrong-head">Para repasar:</p><ul class="exam-wrong-list">' + wrongList.map((q, wi) =>
                '<li>' + q.pregunta + ' → <b>' + q.correcta + '</b>' + (q.articulo ? ' <button class="btn small" type="button" data-wrong-idx="' + wi + '">→ art. ' + q.articulo + '</button>' : '') + '</li>'
              ).join('') + '</ul>'
            : '<p>¡Sin fallos!</p>')
        + '<div class="exam-results-actions"><button class="btn on" id="examRestartBtn">Repetir examen</button></div></div>';
      examBody.querySelector('#examRestartBtn').addEventListener('click', showExamSetup);
      examBody.querySelectorAll('[data-wrong-idx]').forEach(btn => {
        btn.addEventListener('click', () => openRefPreview(wrongList[parseInt(btn.getAttribute('data-wrong-idx'), 10)]));
      });
    }

    return {
      mount(root){
        ac = new AbortController();
        QUESTIONS = allTemas().flatMap(t => t.questions.map(q => ({ ...q, temaId: t.id })));
        BLOQUE_ORDER = allTemas().flatMap(t => t.bloques);
        root.innerHTML = `
      <div class="wrap">
        <p class="eyebrow">${config().eyebrow || ''}</p>
        <h1>Examen</h1>
        <p class="lede">${config().examLede || 'Banco único con las preguntas de todos los temas. Elige qué bloques entran, con o sin temporizador.'}</p>
        <div class="exam-nav">
          <a class="btn" href="#/">📚 Temario</a>
          ${allTemas().map((t, i) => `<a class="btn" href="#/tema/${t.id}">Tema ${i + 1}</a>`).join('\n          ')}
        </div>
        <div class="exam-card">
          <div class="exam-body" id="examBody"></div>
        </div>
        <footer>Preguntas de simulacros reales, filtradas por bloque — se van sumando conforme llegan más simulacros.</footer>
      </div>`;
        examBody = root.querySelector('#examBody');
        showExamSetup();
        return () => {
          clearExamTimer();
          ac.abort();
          examState = null;
        };
      }
    };
  }
};
