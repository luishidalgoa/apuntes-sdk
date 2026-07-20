/* Motor de PASOS compartido: reproductor genérico para simulaciones didácticas
   (algoritmos, autómatas, trazas). Antes estaba duplicado en cada tema —cinco
   copias casi idénticas del bloque play/tick/stop— y cada una reimplementaba el
   índice, el temporizador y el botón ▶/⏸.

   El tema aporta QUÉ pasa (los pasos y cómo se pinta cada uno); el SDK pone el
   cronómetro, los controles, los límites del índice, el contador, la parada
   automática al desmontar y la accesibilidad.

   Dos modos de pintado, según lo que devuelva `render`:
   - devuelve un STRING → el SDK lo vuelca en su contenedor de escena.
   - no devuelve nada    → el tema ya pintó (p.ej. iluminando un SVG que ya
     estaba en la tarjeta); el SDK no toca la escena.

   Los controles de DOMINIO (elegir algoritmo, cambiar la entrada…) NO van aquí:
   los monta el tema y, cuando cambian, llama a `.reload(nuevosPasos)`. */

const ICON = { play: '▶', pause: '⏸', step: '⏭', back: '‹', reset: '↺' };

/* Barra de controles. Solo pinta lo que se pide en `controls`. */
function barHtml(c, total){
  const speedHtml = Array.isArray(c.speed)
    ? '<select class="stp-speed" aria-label="Velocidad">'
      + c.speed.map((s, i) => '<option value="' + s.ms + '"' + (i === 0 ? ' selected' : '') + '>' + s.label + '</option>').join('')
      + '</select>'
    : (c.speed && typeof c.speed === 'object'
      ? '<input class="stp-speed" type="range" min="' + c.speed.min + '" max="' + c.speed.max + '" value="' + (c.speed.value || c.speed.max) + '" aria-label="Velocidad">'
      : '');
  const pos = c.position === false ? ''
    : (c.position === 'dots'
      ? '<span class="stp-dots" aria-hidden="true"></span>'
      : '<span class="stp-pos" aria-live="off">paso <b>0</b>/' + total + '</span>');
  return '<div class="stp-bar">'
    + (c.play  ? '<button class="stp-btn stp-play" type="button">' + ICON.play + '</button>' : '')
    + (c.back  ? '<button class="stp-btn stp-back" type="button" aria-label="Anterior">' + ICON.back + '</button>' : '')
    + (c.step  ? '<button class="stp-btn stp-step" type="button">' + ICON.step + ' Paso</button>' : '')
    + (c.reset ? '<button class="stp-btn stp-reset" type="button" aria-label="Reiniciar">' + ICON.reset + '</button>' : '')
    + speedHtml + pos
    + '</div>';
}

/* Monta un reproductor de pasos en `host`. Devuelve un controlador. */
export function mountStepper(host, spec = {}){
  if(!host) return null;
  const c = Object.assign(
    { play: true, step: true, back: false, reset: true, speed: 1600, position: 'counter', idleIndex: -1 },
    spec.controls || {}
  );

  let steps = typeof spec.steps === 'function' ? spec.steps() : (spec.steps || []);
  let i = c.idleIndex;
  let timer = null;

  /* Chrome del SDK: escena (si hace falta), narración y barra. Se añade al
     final del host para no pisar el contenido que ya tuviera (modo SVG). */
  host.insertAdjacentHTML('beforeend',
    (spec.head ? '<p class="stp-head">' + spec.head + '</p>' : '')
    + '<div class="stp-scene" hidden></div>'
    + '<p class="stp-cap" aria-live="polite"></p>'
    + barHtml(c, steps.length));

  const scene = host.querySelector(':scope > .stp-scene');
  const cap   = host.querySelector(':scope > .stp-cap');
  const bar   = host.querySelector(':scope > .stp-bar');
  const btnPlay = bar.querySelector('.stp-play');
  const btnBack = bar.querySelector('.stp-back');
  const elPos   = bar.querySelector('.stp-pos');
  const elDots  = bar.querySelector('.stp-dots');
  const elSpeed = bar.querySelector('.stp-speed');

  const ms = () => (elSpeed ? Number(elSpeed.value) : (typeof c.speed === 'number' ? c.speed : 1600));
  const atEnd = () => i >= steps.length - 1;

  function paintPos(){
    if(elPos) elPos.innerHTML = 'paso <b>' + Math.max(0, i + 1) + '</b>/' + steps.length;
    if(elDots) elDots.innerHTML = steps.map((_, k) =>
      '<i class="stp-dot' + (k <= i ? ' on' : '') + '"></i>').join('');
    if(btnBack) btnBack.disabled = i <= c.idleIndex;
    if(btnPlay) btnPlay.textContent = timer ? ICON.pause : (atEnd() ? ICON.reset : ICON.play);
  }

  /* Pinta el estado del paso `i`. `acc` es un estado acumulado que el tema
     puede usar (lo necesita, p.ej., una ordenación que arrastra su modelo). */
  function paint(){
    if(spec.reset) spec.reset();
    const acc = spec.acc ? { ...spec.acc } : undefined;
    const run = (k) => {
      const out = spec.render && spec.render({ step: steps[k], index: k, steps, acc, host });
      if(typeof out === 'string'){ scene.hidden = false; scene.innerHTML = out; }
    };
    if(i < 0){
      if(spec.idleMsg) cap.innerHTML = spec.idleMsg;
      if(spec.onIdle) spec.onIdle({ host, scene });
    } else if(spec.cumulative){
      for(let k = 0; k <= i; k++) run(k);          // replay 0..i (pasos con efecto)
      cap.innerHTML = spec.narrate ? spec.narrate({ step: steps[i], index: i, steps, host }) : '';
    } else {
      run(i);
      cap.innerHTML = spec.narrate ? spec.narrate({ step: steps[i], index: i, steps, host }) : '';
    }
    paintPos();
  }

  function stop(){ if(timer){ clearInterval(timer); timer = null; } paintPos(); }
  function next(){
    if(atEnd()){ stop(); return false; }
    i++; paint(); return true;
  }
  function play(){
    if(timer) return stop();
    if(atEnd()) i = c.idleIndex;                    // al final, ▶ reinicia
    timer = setInterval(() => {
      /* Guarda de desmontaje: si el tema ya no está en el documento, el
         temporizador se apaga solo (antes cada widget se dejaba el suyo vivo). */
      if(!host.isConnected) return stop();
      if(!next()) stop();
    }, ms());
    next();
    paintPos();
  }

  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if(!b) return;
    if(b.classList.contains('stp-play'))  return play();
    if(b.classList.contains('stp-step'))  { stop(); return next() || paintPos(); }
    if(b.classList.contains('stp-back'))  { stop(); if(i > c.idleIndex){ i--; paint(); } return; }
    if(b.classList.contains('stp-reset')) { stop(); i = c.idleIndex; return paint(); }
  });
  if(elSpeed) elSpeed.addEventListener('change', () => { if(timer){ stop(); play(); } });

  paint();

  return {
    /* Recalcula los pasos (cambió un control de dominio del tema) y reinicia. */
    reload(newSteps){
      stop();
      steps = typeof newSteps === 'function' ? newSteps() : (newSteps || []);
      i = c.idleIndex;
      paint();
    },
    goTo(n){ stop(); i = Math.max(c.idleIndex, Math.min(n, steps.length - 1)); paint(); },
    get index(){ return i; },
    destroy(){ stop(); }
  };
}

/* Monta un reproductor por cada host que case con `selector` (p.ej. una
   presentación repetida por cada método). Devuelve los controladores. */
export function mountSteppersAll(root, selector, specFor){
  return [...root.querySelectorAll(selector)].map((host, n) => mountStepper(host, specFor(host, n)));
}
