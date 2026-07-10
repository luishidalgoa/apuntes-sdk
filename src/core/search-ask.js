/* Buscador con lenguaje natural (mini-RAG). Genérico del SDK: no sabe de la
   asignatura, solo del índice de contenido y del cliente IA.

   Flujo:
   1. La pregunta natural del usuario se limpia (fuera palabras vacías y de
      pregunta) → quedan los TÉRMINOS CLAVE (p. ej. «AVL», «ABB», «árbol»,
      «binario»). Esto es puramente algorítmico: no interpreta gramática, solo se
      queda con las palabras de contenido.
   2. Con esos términos, el buscador RECUPERA los puntos más relevantes del
      temario (los detecta porque están en el índice).
   3. Se le pasan a la IA como CONTEXTO junto con la pregunta; la IA responde de
      forma concisa y CITA el/los punto(s) que la explican (por su número [n]).
      Esos puntos se convierten en botones «Ir a…» (deep-link al punto exacto).

   Sin clave IA (Groq), los pasos 1-2 funcionan igual: se muestran los puntos
   detectados; solo el paso 3 (respuesta redactada) queda deshabilitado. */
import { searchContent, normalize } from './content-index.js';
import { callGroq } from './ai.js';
import { config } from '../config.js';

/* palabras vacías + de pregunta (ya normalizadas: sin tildes) que no aportan
   señal para recuperar puntos del temario */
const STOP = new Set((
  'a al algo alguna algunas alguno algunos ante antes aqui asi aun bien cada casi como con contra cual cuales cuando cuanta cuantas cuanto cuantos cuya cuyas cuyo cuyos de del desde donde dos e el ella ellas ello ellos en entonces entre era eran es esa esas ese eso esos esta estan estas este esto estos fue fueron ha hace hacen hacia han hasta hay la las le les lo los mas me mi mis mucho muchos muy nada ni no nos nuestra nuestro o os otra otras otro otros para pero poco por porque pues que quien quienes se ser si sin sobre solo son su sus tal tan te tiene todo todos tu tus un una unas uno unos y ya '
  + 'como cual cuales cuando cuanto quien donde por para caracteristica caracteristicas principal principales tipo tipos convierte convertir hace forma parte define definicion significa significado sirve funcion funciona diferencia diferencias ejemplo ejemplos cosa cosas'
).split(/\s+/).filter(Boolean));

const QWORDS = /(^|\s)(qu[eé]|cu[aá]l(?:es)?|c[oó]mo|por\s*qu[eé]|d[oó]nde|cu[aá]ndo|cu[aá]nt[oa]s?|qui[eé]n(?:es)?|para\s*qu[eé])(\s|$|\?)/i;

/* ¿parece una pregunta en lenguaje natural (y no solo un término)? */
export function isQuestion(q){
  const t = (q || '').trim();
  if(!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  return t.endsWith('?') || QWORDS.test(t) || words.length >= 5;
}

/* términos de contenido de la pregunta (fuera palabras vacías). Conserva
   acrónimos cortos (AVL, ABB, GPT, DMA…) de 2+ letras/dígitos. */
export function keyTerms(q){
  const seen = new Set();
  return normalize(q).split(/[^a-z0-9]+/).filter(t => {
    if(t.length < 2 || STOP.has(t)) return false;
    if(t.length < 3 && !/[a-z]{2,}/.test(t)) return false;   // descarta ruido de 1 dígito
    if(seen.has(t)) return false;
    seen.add(t); return true;
  });
}

/* recupera los puntos del temario relevantes para la pregunta (usa el buscador
   con los términos clave). Devuelve las entradas del índice. */
export function retrieve(query, limit = 8){
  const kt = keyTerms(query);
  const rq = kt.length ? kt.join(' ') : query;
  return searchContent(rq, limit);
}

/* pregunta a la IA con los puntos recuperados como contexto. Devuelve la
   respuesta redactada y los puntos citados (para los botones «Ir a…»). */
export async function askTemario(query){
  const terms = keyTerms(query);
  const candidates = retrieve(query, 8);
  if(!candidates.length) return { answer: '', cited: [], candidates: [], terms };

  const ctx = candidates.map((e, i) =>
    `[${i + 1}] Tema ${e.temaNum}${e.num ? ' · ' + e.num : ''} · ${e.title} — ${(e.text || '').slice(0, 240)}`
  ).join('\n');

  const subject = config().subject || config().title || 'este temario';
  const sys = config().searchAiSystemPrompt || (
    `Eres un asistente de estudio de "${subject}". Responde la pregunta del usuario de forma clara y concisa `
    + '(3-5 frases), en español, basándote SOLO en los puntos del temario que se te dan. No inventes: si la '
    + 'respuesta no está en ellos, dilo. Termina SIEMPRE con una línea «Puntos: [n]» citando el número (o números) '
    + 'del punto o puntos de la lista que mejor explican la respuesta.'
  );
  const user = `Puntos del temario disponibles:\n${ctx}\n\nPregunta: ${query}`;

  const res = await callGroq([{ role: 'system', content: sys }, { role: 'user', content: user }], { max_tokens: 380 });
  const data = await res.json();
  if(!res.ok) throw new Error((data.error && data.error.message) || ('Error ' + res.status + ' al llamar a la IA.'));
  const answer = (data.choices && data.choices[0] && data.choices[0].message.content || '').trim();

  /* puntos citados por la IA ([n]) → entradas del índice */
  const cited = [], seen = new Set();
  (answer.match(/\[(\d{1,2})\]/g) || []).forEach(m => {
    const n = parseInt(m.replace(/\D/g, ''), 10) - 1;
    if(candidates[n] && !seen.has(n)){ seen.add(n); cited.push(candidates[n]); }
  });
  return { answer, cited: cited.length ? cited : candidates.slice(0, 2), candidates, terms };
}
