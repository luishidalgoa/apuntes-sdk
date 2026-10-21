/* Markdown mínimo para las notas del alumno: negrita, cursiva, tachado, código,
   resaltado, enlaces http(s), títulos, listas, citas y párrafos. Primero se
   ESCAPA todo el HTML y después se aplica el formato: lo que escribe el usuario
   nunca llega al DOM como marcado. Un salto de línea simple es un salto real. */

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s){
  /* El código se aparta antes que nada: dentro de `…` no se formatea nada. */
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, t, u) => '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + t + '</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
       .replace(/__([^_]+)__/g, '<strong>$1</strong>')
       .replace(/~~([^~]+)~~/g, '<s>$1</s>')
       .replace(/==([^=]+)==/g, '<mark>$1</mark>')
       .replace(/\*([^*]+)\*/g, '<em>$1</em>')
       .replace(/(^|[^\w])_([^_]+)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[i] + '</code>');
}

/* Convierte el texto de una nota en HTML seguro. Vacío → cadena vacía. */
export function renderMarkdown(src){
  const lines = esc(String(src || '')).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [], list = null, quote = [];
  const flushPara  = () => { if(para.length){ out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
  const flushList  = () => { if(list){ out.push('<' + list.tag + '>' + list.items.map(i => '<li>' + inline(i) + '</li>').join('') + '</' + list.tag + '>'); list = null; } };
  const flushQuote = () => { if(quote.length){ out.push('<blockquote>' + quote.map(inline).join('<br>') + '</blockquote>'); quote = []; } };
  const flushAll   = () => { flushPara(); flushList(); flushQuote(); };

  for(const line of lines){
    let m;
    if(!line.trim()){ flushAll(); continue; }
    if((m = line.match(/^(#{1,3})\s+(.*)$/))){
      flushAll(); const n = m[1].length + 3;   /* # → h4, ## → h5, ### → h6 */
      out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); continue;
    }
    if((m = line.match(/^\s*[-*]\s+(.*)$/))){
      flushPara(); flushQuote();
      if(!list || list.tag !== 'ul'){ flushList(); list = { tag: 'ul', items: [] }; }
      list.items.push(m[1]); continue;
    }
    if((m = line.match(/^\s*\d+[.)]\s+(.*)$/))){
      flushPara(); flushQuote();
      if(!list || list.tag !== 'ol'){ flushList(); list = { tag: 'ol', items: [] }; }
      list.items.push(m[1]); continue;
    }
    if((m = line.match(/^&gt;\s?(.*)$/))){
      flushPara(); flushList(); quote.push(m[1]); continue;
    }
    flushList(); flushQuote(); para.push(line);
  }
  flushAll();
  return out.join('');
}
