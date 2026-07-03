/* Modo tablet: estado global (clase en <body>) persistido en la MISMA clave
   localStorage que usaban los HTML antiguos, para no perder la preferencia. */
let tabletMode = false;
try{ tabletMode = localStorage.getItem('ce-tablet-mode') === '1'; }catch(e){}

export function applyTabletMode(){
  document.body.classList.toggle('tablet-mode', tabletMode);
}

export function bindTabletButton(btn, { signal } = {}){
  const update = () => {
    document.body.classList.toggle('tablet-mode', tabletMode);
    btn.classList.toggle('on', tabletMode);
    btn.lastChild.textContent = tabletMode ? ' Modo tablet activo' : ' Modo tablet';
  };
  update();
  btn.addEventListener('click', () => {
    tabletMode = !tabletMode;
    try{ localStorage.setItem('ce-tablet-mode', tabletMode ? '1' : '0'); }catch(e){}
    update();
  }, { signal });
}
