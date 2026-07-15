/* Modo tablet: estado global (clase en <body>) persistido en la MISMA clave
   localStorage que usaban los HTML antiguos, para no perder la preferencia.
   El modo agranda tipografías/espaciado y ensancha el layout: está pensado para
   TABLETS, no para teléfonos. Por eso NUNCA se aplica en pantallas de teléfono
   (≤600px) aunque la preferencia esté guardada, y se reevalúa al redimensionar
   o rotar. */
let tabletMode = false;
try{ tabletMode = localStorage.getItem('ce-tablet-mode') === '1'; }catch(e){}

// matchMedia se evalúa al importar; en node (scripts vía registry→SDK) no existe.
const phoneMql = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(max-width:600px)') : null;
const isPhone = () => !!(phoneMql && phoneMql.matches);
const apply = () => document.body.classList.toggle('tablet-mode', tabletMode && !isPhone());

export function applyTabletMode(){
  apply();
  try{ phoneMql.addEventListener('change', apply); }catch(e){ try{ phoneMql.addListener(apply); }catch(_){} }
}

export function bindTabletButton(btn, { signal } = {}){
  const update = () => {
    apply();
    const phone = isPhone();
    btn.classList.toggle('on', tabletMode && !phone);
    btn.disabled = phone;
    btn.title = phone ? 'El modo tablet no está disponible en el móvil' : '';
    btn.lastChild.textContent = tabletMode ? ' Modo tablet activo' : ' Modo tablet';
  };
  update();
  btn.addEventListener('click', () => {
    if(isPhone()) return;                       // en teléfono el modo no aplica
    tabletMode = !tabletMode;
    try{ localStorage.setItem('ce-tablet-mode', tabletMode ? '1' : '0'); }catch(e){}
    update();
  }, { signal });
  try{ phoneMql.addEventListener('change', update, { signal }); }catch(e){}
}
