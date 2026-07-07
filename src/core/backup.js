/* Copia de seguridad de las anotaciones del usuario (subrayados, marcas★,
   marcapáginas, notas…) — export / import de un fichero JSON. Como no hay
   backend, es la red de seguridad para no perder el trabajo: el usuario exporta
   un JSON (lo guarda donde quiera) y lo importa para restaurar, en cualquier
   navegador o dispositivo. Respalda TODAS las claves de localStorage de la app. */

const FORMAT = 'apuntes-backup';
const VERSION = 1;

/* Objeto de copia (todas las entradas de localStorage). */
export function buildBackup(appName){
  const data = {};
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    data[k] = localStorage.getItem(k);
  }
  return { format: FORMAT, version: VERSION, app: appName || 'apuntes', exportedAt: new Date().toISOString(), data };
}

/* Escribe en localStorage las claves de una copia. Devuelve cuántas restauró. */
export function applyBackup(payload){
  const data = payload && payload.data;
  if(!data || typeof data !== 'object') return 0;
  let n = 0;
  for(const k of Object.keys(data)){
    try { localStorage.setItem(k, data[k]); n++; } catch (_) {}
  }
  return n;
}

/* Descarga el JSON. */
export function exportBackup(appName){
  const payload = buildBackup(appName);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'apuntes-copia-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Abre el selector de fichero, valida, pide confirmación y restaura. */
export function importBackup({ onDone } = {}){
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let payload;
      try { payload = JSON.parse(reader.result); } catch (_) { payload = null; }
      if(!payload || payload.format !== FORMAT || !payload.data){
        alert('Ese fichero no es una copia de seguridad válida.');
        return;
      }
      const count = Object.keys(payload.data).length;
      const when = (payload.exportedAt || '').slice(0, 10);
      if(!confirm('Restaurar la copia' + (when ? ' del ' + when : '') + ' (' + count + ' entradas)?\nSe sobrescriben tus anotaciones actuales con las de este fichero.')) return;
      applyBackup(payload);
      if(onDone) onDone();
    };
    reader.readAsText(file);
  });
  input.click();
}
