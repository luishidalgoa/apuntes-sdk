/* Detección de enumeraciones a) b) c)… / 1.º 2.º… dentro de un párrafo.

   Vive aparte porque la usan DOS superficies —el panel de texto literal y el
   cuerpo de teoría— y dos heurísticas separadas divergirían: una acabaría
   troceando lo que la otra deja corrido, y el mismo artículo se vería distinto
   según por dónde lo abras. */

/* Detecta en `text` una enumeración consecutiva desde el primer marcador y
   devuelve {intro, items}. Genérico: `re` captura (separador)(token) del
   marcador; `isFirst`/`nextOf` definen la secuencia (letras a·b·c… u ordinales
   1·2·3…). Guardas: exige empezar en el primer token y ≥2 ítems consecutivos, y
   descarta referencias sueltas ("…conforme a la letra a)"). */
export function detectRun(text, re, isFirst, nextOf){
  let m; const marks = [];
  re.lastIndex = 0;
  while((m = re.exec(text))){ marks.push({ tok: m[2], at: m.index + m[1].length, after: re.lastIndex, disp: m[0].slice(m[1].length).trim() }); }
  if(marks.length < 2) return null;
  const start = marks.findIndex(x => isFirst(x.tok));
  if(start === -1) return null;
  const seq = [marks[start]];
  for(let i = start + 1; i < marks.length; i++){
    if(marks[i].tok === nextOf(seq[seq.length - 1].tok)) seq.push(marks[i]); else break;
  }
  if(seq.length < 2) return null;
  const intro = text.slice(0, seq[0].at);
  if(/\b(letras?|apartados?|párrafos?|numeros?|números?|puntos?|reglas?|incisos?)\s+$/i.test(intro)) return null;
  const items = seq.map((mk, i) => {
    const end = (i + 1 < seq.length) ? seq[i + 1].at : text.length;
    return { disp: mk.disp, text: text.slice(mk.after, end).replace(/^[\s.:,;)–-]+/, '').trim() };
  });
  return { intro: intro.trim(), items };
}

/* Prueba letras a) b) c)… y, si no, ordinales 1.º 2.º… */
export function listData(text){
  return detectRun(text, /(^|[\s(])([a-z])\)/g, t => t === 'a', t => String.fromCharCode(t.charCodeAt(0) + 1))
    || detectRun(text, /(^|[\s(])(\d+)\.[ºªo]/g, t => t === '1', t => String(parseInt(t, 10) + 1));
}
