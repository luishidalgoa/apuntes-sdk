/* Vista Examen: banco único agregado de TODOS los temas del registry,
   filtrable por bloque (título de la CE), con temporizador opcional,
   asistente IA y vista previa del temario sin salir del examen. */
import { allTemas, bloqueOf, hasBloques } from '../registry.js';
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
    let TEMA_GROUPS = [];   // [{ id, label, bloques:[...] }] — solo bloques con preguntas

    function clearExamTimer(){ if(examTimer){ clearInterval(examTimer); examTimer = null; } }

    /* initialTema: si viene de la página de un tema (#/examen/<id>), se
       preseleccionan solo los bloques de ese tema (los demás quedan sin marcar,
       pero se pueden expandir y añadir). Sin él → todo marcado. */
    function showExamSetup(initialTema){
      clearExamTimer();
      const esc = s => String(s).replace(/"/g, '&quot;');
      const countBloque = (b) => QUESTIONS.filter(q => q.bloque === b).length;
      const countTema = (g) => g.bloques.reduce((s, b) => s + countBloque(b), 0);
      const hasInitial = initialTema && TEMA_GROUPS.some(g => g.id === initialTema);
      const total = QUESTIONS.length;

      let idx = 0;
      const temaGroupHtml = (g) => {
        const on = !hasInitial || g.id === initialTema;
        const rows = g.bloques.map(b => {
          const id = 'exb' + (idx++);
          return '<div class="exam-bloque-row"><input type="checkbox" class="exam-bloque-cb" id="' + id + '" data-tema="' + esc(g.id) + '" data-bloque="' + esc(b) + '"' + (on ? ' checked' : '') + '/>'
            + '<label for="' + id + '">' + b + '</label><span class="exam-tema-count">' + countBloque(b) + '</span></div>';
        }).join('');
        return '<div class="exam-tema-group" data-tema="' + esc(g.id) + '">'
          + '<div class="exam-tema-row exam-tema-head">'
          +   '<input type="checkbox" class="exam-tema-cb" data-tema="' + esc(g.id) + '"' + (on ? ' checked' : '') + '/>'
          +   '<label>' + g.label + '</label>'
          +   '<span class="exam-tema-count">' + countTema(g) + '</span>'
          +   '<button class="exam-tema-toggle" type="button" aria-expanded="false" aria-label="Ver bloques del tema">▸</button>'
          + '</div>'
          + '<div class="exam-bloques" hidden>' + rows + '</div>'
          + '</div>';
      };

      /* Si los temas declaran `bloque`, se agrupan bajo una cabecera de bloque
         (con checkbox que marca/desmarca todos sus temas). Genérico: si no hay
         bloques, se listan los temas directamente (como antes). */
      let groupsHtml;
      if(hasBloques()){
        const blocks = []; const byId = new Map();
        TEMA_GROUPS.forEach(g => {
          const key = g.bloque ? g.bloque.id : ' ';
          let bg = byId.get(key);
          if(!bg){ bg = { id: g.bloque ? g.bloque.id : null, label: g.bloque ? g.bloque.label : null, temas: [] }; byId.set(key, bg); blocks.push(bg); }
          bg.temas.push(g);
        });
        groupsHtml = blocks.map(bg => {
          const inner = bg.temas.map(temaGroupHtml).join('');
          if(!bg.label) return inner;   // temas sin bloque: sin cabecera
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
        + '<p class="exam-setup-warn" id="examSetupWarn" style="display:none">Selecciona al menos un bloque.</p>'
        + '<p class="exam-setup-label">¿Con temporizador?</p>'
        + '<div class="opts exam-time-opts"><button class="btn" data-timed="0">Sin temporizador</button><button class="btn" data-timed="1">⏱ Con temporizador (45s/pregunta)</button></div>'
        + '<p class="exam-setup-label">¿Cuántas preguntas?</p>'
        + '<div class="opts"><button class="btn" data-n="10">10</button><button class="btn" data-n="20">20</button><button class="btn" data-n="0">Todas (<span id="examPoolCount">' + selCount + '</span>)</button></div>'
        + '</div>';

      const allCb = examBody.querySelector('#examTemaAll');
      const temaCbs = [...examBody.querySelectorAll('.exam-tema-cb')];
      const bloqueCbs = [...examBody.querySelectorAll('.exam-bloque-cb')];
      const bloquegCbs = [...examBody.querySelectorAll('.exam-bloqueg-cb')];   // checkboxes de nivel "bloque"
      const poolCountEl = examBody.querySelector('#examPoolCount');
      const warnEl = examBody.querySelector('#examSetupWarn');
      let timedChoice = false;

      const seleccionados = () => bloqueCbs.filter(c => c.checked).map(c => c.getAttribute('data-bloque'));
      const bloquesOf = (id) => bloqueCbs.filter(c => c.getAttribute('data-tema') === id);
      // Capa "bloque": mapear tema→bloque y sus checkboxes, para sincronizar el nivel superior.
      const bloqueGOf = (temaId) => { const g = TEMA_GROUPS.find(x => x.id === temaId); return g && g.bloque ? g.bloque.id : null; };
      const temaIdsOfBloqueG = (bid) => TEMA_GROUPS.filter(g => (g.bloque ? g.bloque.id : null) === bid).map(g => g.id);
      const temaCbsOfBloqueG = (bid) => { const ids = temaIdsOfBloqueG(bid); return temaCbs.filter(c => ids.includes(c.getAttribute('data-tema'))); };
      const bloqueCbsOfBloqueG = (bid) => { const ids = temaIdsOfBloqueG(bid); return bloqueCbs.filter(c => ids.includes(c.getAttribute('data-tema'))); };
      function syncBloqueG(bid){
        if(bid == null) return;
        const bg = bloquegCbs.find(c => c.getAttribute('data-bloque-id') === bid);
        if(!bg) return;
        const cbs = bloqueCbsOfBloqueG(bid), on = cbs.filter(c => c.checked).length;
        bg.checked = on === cbs.length; bg.indeterminate = on > 0 && on < cbs.length;
      }
      function syncTema(id){
        const cbs = bloquesOf(id), t = temaCbs.find(c => c.getAttribute('data-tema') === id);
        const on = cbs.filter(c => c.checked).length;
        t.checked = on === cbs.length; t.indeterminate = on > 0 && on < cbs.length;
        syncBloqueG(bloqueGOf(id));
      }
      function syncAll(){
        const on = bloqueCbs.filter(c => c.checked).length;
        allCb.checked = on === bloqueCbs.length; allCb.indeterminate = on > 0 && on < bloqueCbs.length;
      }
      function updatePoolCount(){ const sel = seleccionados(); poolCountEl.textContent = QUESTIONS.filter(q => sel.includes(q.bloque)).length; }

      TEMA_GROUPS.forEach(g => syncTema(g.id)); syncAll();
      allCb.addEventListener('change', () => {
        bloqueCbs.forEach(c => c.checked = allCb.checked);
        temaCbs.forEach(c => { c.checked = allCb.checked; c.indeterminate = false; });
        bloquegCbs.forEach(c => { c.checked = allCb.checked; c.indeterminate = false; });
        updatePoolCount();
      });
      bloquegCbs.forEach(bg => bg.addEventListener('change', () => {
        const bid = bg.getAttribute('data-bloque-id');
        bloqueCbsOfBloqueG(bid).forEach(c => c.checked = bg.checked);
        temaCbsOfBloqueG(bid).forEach(c => { c.checked = bg.checked; c.indeterminate = false; });
        bg.indeterminate = false; syncAll(); updatePoolCount();
      }));
      temaCbs.forEach(t => t.addEventListener('change', () => {
        bloquesOf(t.getAttribute('data-tema')).forEach(c => c.checked = t.checked);
        t.indeterminate = false; syncBloqueG(bloqueGOf(t.getAttribute('data-tema'))); syncAll(); updatePoolCount();
      }));
      bloqueCbs.forEach(c => c.addEventListener('change', () => { syncTema(c.getAttribute('data-tema')); syncAll(); updatePoolCount(); }));
      examBody.querySelectorAll('.exam-tema-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const box = btn.closest('.exam-tema-group').querySelector('.exam-bloques');
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
      examBody.querySelector('#examRestartBtn').addEventListener('click', () => showExamSetup());
      examBody.querySelectorAll('[data-wrong-idx]').forEach(btn => {
        btn.addEventListener('click', () => openRefPreview(wrongList[parseInt(btn.getAttribute('data-wrong-idx'), 10)]));
      });
    }

    return {
      mount(root, route){
        ac = new AbortController();
        QUESTIONS = allTemas().flatMap(t => t.questions.map(q => ({ ...q, temaId: t.id })));
        TEMA_GROUPS = allTemas().map(t => {
          const num = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1];
          return { id: t.id, label: num ? ('Tema ' + num + ' · ' + t.titulo) : (t.titulo || t.id),
            bloque: bloqueOf(t),   // capa opcional "bloque" (agnóstica) por encima del tema
            bloques: (t.bloques || []).filter(b => QUESTIONS.some(q => q.bloque === b)) };
        }).filter(g => g.bloques.length);
        root.innerHTML = `
      <div class="wrap">
        <p class="eyebrow">${config().eyebrow || ''}</p>
        <h1>Examen</h1>
        <p class="lede">${config().examLede || 'Banco único con las preguntas de todos los temas. Elige de qué temas o bloques examinarte, con o sin temporizador.'}</p>
        <div class="exam-nav">
          <a class="btn" href="#/">📚 Temario</a>
          ${allTemas().map((t, i) => { const n = (String(t.k || '').match(/Tema\s+(\d+)/i) || [])[1] || String(i + 1); return `<a class="btn" href="#/tema/${t.id}">Tema ${n}</a>`; }).join('\n          ')}
        </div>
        <div class="exam-card">
          <div class="exam-body" id="examBody"></div>
        </div>
        <footer>Preguntas de simulacros reales, filtradas por bloque — se van sumando conforme llegan más simulacros.</footer>
      </div>`;
        examBody = root.querySelector('#examBody');
        showExamSetup(route && route.temaId);
        return () => {
          clearExamTimer();
          ac.abort();
          examState = null;
        };
      }
    };
  }
};
