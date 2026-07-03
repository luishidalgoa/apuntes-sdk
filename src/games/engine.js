/* Motor de minijuegos compartido (antes duplicado en Tema 1 y Tema 2):
   overlay modal + menú + clasificación (sorting) + flashcards + resultados.
   Cada tema declara sus juegos en el manifiesto:
     games: [{ id, ico, title, desc, start(api) }]
   y el motor aporta el api: { body, showMenu, playSorting(cfg), startFlashcards() }.
   Nota de clases: el modal usa .modal-* (en los HTML viejos reutilizaba
   .exam-card, que ahora es la tarjeta de la vista Examen). */
import { registerLayer } from '../core/modal-stack.js';

let overlay, gamesBody, gamesTitle;
let current = null;   // { ctx, games }

export function mountGamesOverlay(shell){
  shell.insertAdjacentHTML('beforeend', `
<div id="gamesOverlay" role="dialog" aria-label="Minijuegos">
  <div class="modal-card">
    <div class="modal-head">
      <span class="modal-title">🎮 Minijuegos</span>
      <button class="modal-close" type="button" aria-label="Cerrar minijuegos">✕</button>
    </div>
    <div class="modal-body" id="gamesBody"></div>
  </div>
</div>`);
  overlay = shell.querySelector('#gamesOverlay');
  gamesBody = overlay.querySelector('#gamesBody');
  gamesTitle = overlay.querySelector('.modal-title');
  overlay.querySelector('.modal-close').addEventListener('click', closeGames);
  registerLayer({ isOpen: () => overlay.classList.contains('open'), close: closeGames, priority: 30 });
}

export function openGames(ctx, games){
  current = { ctx, games };
  showMenu();
  overlay.classList.add('open');
}
export function closeGames(){
  overlay.classList.remove('open');
}

function showMenu(){
  const { games } = current;
  gamesBody.innerHTML =
    '<div class="games-menu">'
    + games.map(g =>
        '<button class="game-menu-card" data-game="' + g.id + '"><span class="gmc-ico">' + g.ico + '</span><span><span class="gmc-title">' + g.title + '</span><span class="gmc-desc">' + g.desc + '</span></span></button>'
      ).join('')
    + '</div>';
  gamesBody.querySelectorAll('.game-menu-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const game = current.games.find(g => g.id === btn.getAttribute('data-game'));
      if(game) game.start(api);
    });
  });
}

/* ---------- clasificación rápida (cubos) ---------- */
function playSorting(cfg){
  let items = cfg.items.slice();
  for(let i = items.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const rounds = Math.min(cfg.rounds || items.length, items.length);
  items = items.slice(0, rounds);
  renderSortRound({ cfg, items, index: 0, score: 0, missed: [] });
}

function renderSortRound(state){
  const { cfg, items, index, score } = state;
  const item = items[index];
  gamesBody.innerHTML =
    '<div class="exam-progress"><span>' + cfg.title + ' · ' + (index + 1) + '/' + items.length + '</span><span>Aciertos: ' + score + '</span></div>'
    + '<div class="sort-prompt">' + item.prompt + '</div>'
    + '<div class="sort-buckets">' + cfg.buckets.map(b => '<button class="sort-bucket" data-key="' + b.key + '">' + b.label + '</button>').join('') + '</div>';
  gamesBody.querySelectorAll('.sort-bucket').forEach(btn => {
    btn.addEventListener('click', () => onSortAnswer(state, btn));
  });
}

function onSortAnswer(state, btn){
  const { items, index } = state;
  const item = items[index];
  const isCorrect = btn.getAttribute('data-key') === item.correctKey;
  gamesBody.querySelectorAll('.sort-bucket').forEach(b => {
    b.disabled = true;
    if(b.getAttribute('data-key') === item.correctKey) b.classList.add('correct');
    else if(b === btn) b.classList.add('incorrect');
  });
  if(isCorrect) state.score++;
  else state.missed.push(item);
  setTimeout(() => {
    state.index++;
    if(state.index >= items.length) renderSortResults(state);
    else renderSortRound(state);
  }, 700);
}

function renderSortResults(state){
  const { cfg, items, score, missed } = state;
  gamesBody.innerHTML =
    '<div class="exam-results">'
    + '<p class="exam-score">' + score + ' / ' + items.length + '</p>'
    + (missed.length
        ? '<p class="exam-wrong-head">Para repasar:</p><ul class="exam-wrong-list">' + missed.map(m => {
            const b = cfg.buckets.find(x => x.key === m.correctKey);
            return '<li>' + m.prompt + ' → <b>' + (b ? b.label : m.correctKey) + '</b></li>';
          }).join('') + '</ul>'
        : '<p>¡Sin fallos!</p>')
    + '<div class="exam-results-actions">'
    + '<button class="btn on" id="gameRestartBtn">Repetir</button>'
    + '<button class="btn" id="gameMenuBtn">Menú de minijuegos</button>'
    + '</div></div>';
  gamesBody.querySelector('#gameRestartBtn').addEventListener('click', () => playSorting(cfg));
  gamesBody.querySelector('#gameMenuBtn').addEventListener('click', showMenu);
}

/* ---------- flashcards (se derivan solas de las secciones del tema activo) ---------- */
function buildFlashDeck(ctx){
  return Object.keys(ctx.sections).map(key => {
    const art = ctx.sections[key];
    const back = art.apartados
      ? art.apartados.map(ap => (ap.n ? ('<b>' + ap.n + '.</b> ') : '') + String(ap.text).replace(/<[^>]+>/g, '')).join(' ')
      : String(art.text).replace(/<[^>]+>/g, '');
    return { num: ctx.labelFor(key), title: art.title, back };
  });
}

function startFlashcards(){
  let deck = buildFlashDeck(current.ctx);
  for(let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  renderFlashcard({ deck, index: 0, known: 0, review: [] });
}

function renderFlashcard(state){
  const { deck, index, known } = state;
  if(index >= deck.length){ renderFlashResults(state); return; }
  const card = deck[index];
  gamesBody.innerHTML =
    '<div class="exam-progress"><span>Flashcards · ' + (index + 1) + '/' + deck.length + '</span><span>Sabidas: ' + known + '</span></div>'
    + '<div class="flash-card" id="flashCard">'
    + '<div class="flash-front">' + card.num + '<span class="flash-front-title">' + card.title + '</span></div>'
    + '<div class="flash-back" style="display:none">' + card.back + '</div>'
    + '</div>'
    + '<p class="flash-hint" id="flashHint">Toca la tarjeta para ver la respuesta</p>'
    + '<div class="flash-actions" id="flashActions" style="display:none"><button class="btn" id="flashNo">✗ No la sabía</button><button class="btn on" id="flashYes">✓ La sabía</button></div>';
  gamesBody.querySelector('#flashCard').addEventListener('click', () => {
    gamesBody.querySelector('.flash-front').style.display = 'none';
    gamesBody.querySelector('.flash-back').style.display = 'block';
    gamesBody.querySelector('#flashHint').style.display = 'none';
    gamesBody.querySelector('#flashActions').style.display = 'flex';
  });
  gamesBody.querySelector('#flashYes').addEventListener('click', (e) => { e.stopPropagation(); state.known++; state.index++; renderFlashcard(state); });
  gamesBody.querySelector('#flashNo').addEventListener('click', (e) => { e.stopPropagation(); state.review.push(card); state.index++; renderFlashcard(state); });
}

function renderFlashResults(state){
  const { deck, known, review } = state;
  gamesBody.innerHTML =
    '<div class="exam-results">'
    + '<p class="exam-score">' + known + ' / ' + deck.length + ' dominadas</p>'
    + (review.length
        ? '<p class="exam-wrong-head">Para repasar (' + review.length + '):</p><ul class="exam-wrong-list">' + review.map(c => '<li>' + c.num + ' — ' + c.title + '</li>').join('') + '</ul>'
        : '<p>¡Te las sabías todas!</p>')
    + '<div class="exam-results-actions">'
    + (review.length ? '<button class="btn on" id="flashReviewBtn">Repasar solo las falladas</button>' : '')
    + '<button class="btn" id="flashRestartBtn">Repetir todo el mazo</button>'
    + '<button class="btn" id="gameMenuBtn2">Menú de minijuegos</button>'
    + '</div></div>';
  if(review.length){
    gamesBody.querySelector('#flashReviewBtn').addEventListener('click', () => renderFlashcard({ deck: review.slice(), index: 0, known: 0, review: [] }));
  }
  gamesBody.querySelector('#flashRestartBtn').addEventListener('click', startFlashcards);
  gamesBody.querySelector('#gameMenuBtn2').addEventListener('click', showMenu);
}

const api = {
  get body(){ return gamesBody; },
  showMenu,
  playSorting,
  startFlashcards
};
