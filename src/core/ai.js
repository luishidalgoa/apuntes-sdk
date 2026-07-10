/* Cliente IA compartido (Groq). Estrategia de conexión (igual que el tutor del
   examen, ahora centralizada para reutilizarla también en el buscador):
   1. Si la página se sirve por http(s), intenta el proxy same-origin /api/groq
      (Vercel; la clave queda en el servidor).
   2. Si el proxy no existe (404) o falla la red (file://, visor offline), cae a
      la llamada directa con la clave embebida — que SOLO existe en la copia
      local (release.mjs sustituye el placeholder). El build de Vercel va sin clave. */
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const EMBEDDED_KEY = '__GROQ_KEY__';

let proxyAvailable = null; // cache de la detección

export async function callGroq(messages, { max_tokens = 400, temperature = 0.3 } = {}){
  if(proxyAvailable !== false && location.protocol.indexOf('http') === 0){
    try{
      const r = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, max_tokens, temperature })
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
    body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens, temperature })
  });
}
