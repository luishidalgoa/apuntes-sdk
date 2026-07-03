/* Asistente IA del examen. Estrategia de conexión:
   1. Si la página se sirve por http(s), intenta el proxy same-origin /api/groq
      (Vercel; la clave queda en el servidor).
   2. Si el proxy no existe (404) o falla la red (file://, localhost, visor web
      de Nextcloud), cae a la llamada directa con la clave embebida — que SOLO
      existe en la copia local TemarioTAI.html (release.mjs sustituye el
      placeholder). El build de Vercel se despliega sin clave. */
import { config } from '../config.js';

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const EMBEDDED_KEY = '__GROQ_KEY__';

let proxyAvailable = null; // cache de la detección

async function callGroq(messages){
  if(proxyAvailable !== false && location.protocol.indexOf('http') === 0){
    try{
      const r = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, max_tokens: 400, temperature: 0.3 })
      });
      if(r.status !== 404){ proxyAvailable = true; return r; }
      proxyAvailable = false;
    }catch(e){
      proxyAvailable = false;
    }
  }
  if(!EMBEDDED_KEY || EMBEDDED_KEY.indexOf('__GROQ') === 0){
    throw new Error('el asistente no está disponible en esta copia (sin clave local ni proxy).');
  }
  return fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + EMBEDDED_KEY },
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 400, temperature: 0.3 })
  });
}

export function renderAiPanel(container, q, userAnswer){
  container.innerHTML =
    '<div class="exam-ai-thread" id="aiThread"></div>'
    + '<div class="exam-ai-input-row"><input type="text" id="aiInput" placeholder="Escribe tu duda sobre esta pregunta..."/><button class="btn small on" id="aiSend">Enviar</button></div>';
  const thread = container.querySelector('#aiThread');
  const input = container.querySelector('#aiInput');
  const sendBtn = container.querySelector('#aiSend');
  function addMsg(role, text){
    const div = document.createElement('div');
    div.className = 'exam-ai-msg ' + role;
    div.textContent = text;
    thread.appendChild(div);
    thread.scrollTop = thread.scrollHeight;
    return div;
  }
  async function send(){
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    addMsg('user', text);
    const loading = addMsg('assistant', 'Pensando…');
    const intro = config().aiSystemPrompt
      || 'Eres un tutor que ayuda a resolver dudas sobre una pregunta de examen tipo test. '
       + 'Responde en español, en máximo 4-5 frases, centrado en la duda concreta del usuario. '
       + 'Si no estás seguro de un dato, dilo en vez de inventarlo.';
    const sys = intro + '\n\n'
      + 'Pregunta del examen: ' + q.pregunta + '\n'
      + 'Opciones: ' + q.respuestas.join(' | ') + '\n'
      + 'Respuesta correcta: ' + q.correcta + '\n'
      + (userAnswer ? ('Respuesta que marcó el usuario: ' + userAnswer + (userAnswer === q.correcta ? ' (acertó)' : ' (falló)') + '\n') : (userAnswer === null ? 'El usuario no llegó a responder: se agotó el tiempo.\n' : ''))
      + (q.explicacion ? ('Explicación ya dada: ' + q.explicacion + '\n') : '')
      + (q.articulo ? ('Referencia relacionada: ' + q.articulo) : '');
    try{
      const res = await callGroq([{ role: 'system', content: sys }, { role: 'user', content: text }]);
      const data = await res.json();
      loading.remove();
      if(!res.ok) addMsg('error', (data.error && data.error.message) ? data.error.message : ('Error ' + res.status + ' al llamar a Groq.'));
      else addMsg('assistant', data.choices[0].message.content.trim());
    } catch(err){
      loading.remove();
      addMsg('error', 'No se pudo contactar con el asistente: ' + err.message);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if(e.key === 'Enter') send(); });
}
