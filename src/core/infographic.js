/* Infografía de cierre de un título/sección: un recap visual data-driven que
   se coloca al final del contenido de un tema. El SDK aporta el MOTOR de
   maquetación (bloques tipados), un catálogo de iconos de línea y el temado
   por acento (--info-accent); la app aporta el CONTENIDO (el spec) y, si
   quiere, ilustraciones SVG propias por título (o imágenes en base64).

   spec = {
     accent?, eyebrow?, title, sub?, tag?, aria?, srSummary?,
     illus?,                         // <svg>…</svg> propio del título (opcional)
     blocks: [
       { type:'attrs', title, art?, items:[{text, hi?}] },
       { type:'icons', title, art?, items:[{icon, text, sup?}], foot? },
       { type:'steps', title, art?, items:[{t, d}], note?:{icon?, html} },
       { type:'flows', title, art?, cards:[{icon?, title, flow:[…], note?}] },
       { type:'banner', icon?, html },
       { type:'rule' }
     ]
   }
   Los bloques con `title` se numeran solos (01, 02…) salvo que traigan `n`.
   El texto admite HTML (contenido de confianza autorado por la app). */
import { esc } from './dom.js';

/* Catálogo de iconos de línea (viewBox 24, stroke=currentColor → los tiñe el
   CSS). Un `icon` del spec puede ser una clave de aquí o SVG en crudo (empieza
   por "<"), para dar libertad artística por ítem. */
export const INFO_ICONS = {
  law:        '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/>',
  parliament: '<path d="M3 9l9-5 9 5"/><path d="M5 9v9M9.3 9v9M14.7 9v9M19 9v9"/><path d="M3 21h18"/>',
  ballot:     '<path d="M4 9h16v11H4z"/><path d="M8.5 9l1-4h5l1 4"/><path d="M9.5 14l1.6 1.6L15 12"/>',
  person:     '<circle cx="12" cy="7" r="3"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>',
  shield:     '<path d="M12 3l7 3v5c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6z"/><path d="M9.3 12l2 2 3.4-4"/>',
  globe:      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/>',
  scale:      '<path d="M12 3v17M7.5 20h9"/><path d="M5 8h14"/><path d="M5 8l-2 4a3 3 0 0 0 6 0z"/><path d="M19 8l-2 4a3 3 0 0 0 6 0z"/>',
  key:        '<circle cx="8" cy="8" r="4"/><path d="M10.8 10.8L20 20M16 16l2.2-2.2M18.2 18.2l2.2-2.2"/>',
  crown:      '<path d="M4 17l3-8 5 4 5-4 3 8z"/><path d="M4 20h16"/>',
  regent:     '<path d="M6 20l1.5-8L12 15l4.5-3L18 20z"/><path d="M5 20h14"/><circle cx="12" cy="6" r="2.3"/>',
  tutor:      '<path d="M12 3l8 3.5v4c0 5-3.4 8-8 9.5-4.6-1.5-8-4.5-8-9.5v-4z"/><path d="M12 8v6M9 11h6"/>',
  pen:        '<path d="M4 20l9-9M13 11l3 3 4-4-3-3z"/><path d="M14 4l6 6"/><path d="M4 20l3-1"/>',
  book:       '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M8 3v14"/>',
  gavel:      '<path d="M14 3l7 7-3 3-7-7z"/><path d="M9 8l-5 5 3 3 5-5"/><path d="M5 21h9"/>',
  scroll:     '<path d="M6 4h11a2 2 0 0 1 2 2v11a2 2 0 0 0 2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2z"/><path d="M9 8h7M9 12h7"/>',
  flag:       '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  people:     '<circle cx="9" cy="8" r="3"/><path d="M2.5 20v-1a5 5 0 0 1 8.5-3.4"/><circle cx="16.5" cy="9.5" r="2.6"/><path d="M12.5 20v-.4a4.2 4.2 0 0 1 8.5 0V20"/>',
  compass:    '<circle cx="12" cy="12" r="9"/><path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  alert:      '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5"/><path d="M12 17.6v.02"/>',
  heart:      '<path d="M12 20s-7-4.5-9.4-9A5 5 0 0 1 12 6a5 5 0 0 1 9.4 5C19 15.5 12 20 12 20z"/>',
  calendar:   '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M9 3v4M15 3v4"/>',
  clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>',
  chat:       '<path d="M21 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/>',
  briefcase:  '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12.5h18"/>',
  check:      '<path d="M20 6L9 17l-5-5"/>'
};

function iconSvg(icon){
  if(!icon) return '';
  const inner = String(icon).charAt(0) === '<' ? icon : (INFO_ICONS[icon] || '');
  return inner ? `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>` : '';
}

function sectionHead(b){
  if(!b.title) return '';
  const n = b.n ? `<span class="info-n">${b.n}</span>` : '';
  const art = b.art ? `<span class="info-art">${b.art}</span>` : '';
  return `<div class="info-sech">${n}<h4>${b.title}</h4>${art}</div>`;
}

function renderAttrs(b){
  return sectionHead(b) + '<div class="info-attrs">'
    + (b.items || []).map(it => `<span class="info-chip${it.hi ? ' hi' : ''}">${it.text}</span>`).join('')
    + '</div>';
}

function renderIcons(b){
  const foot = b.foot ? `<div class="info-foot">${b.foot}</div>` : '';
  return sectionHead(b) + '<div class="info-grid">'
    + (b.items || []).map(it =>
        `<div class="info-tile"><span class="info-ico">${iconSvg(it.icon)}</span>`
        + `<span>${it.text}${it.sup ? `<sup>${it.sup}</sup>` : ''}</span></div>`).join('')
    + '</div>' + foot;
}

function renderSteps(b){
  const note = b.note
    ? `<div class="info-heir">${iconSvg(b.note.icon)}<span>${b.note.html}</span></div>` : '';
  return sectionHead(b) + '<div class="info-steps">'
    + (b.items || []).map((it, i) =>
        `<div class="info-step"><span class="info-num">${i + 1}</span>`
        + `<div class="info-step-t">${it.t}</div><div class="info-step-d">${it.d || ''}</div></div>`).join('')
    + '</div>' + note;
}

function renderFlows(b){
  return sectionHead(b) + '<div class="info-two">'
    + (b.cards || []).map(c => {
        const sep = c.sep || '→';
        const flow = (c.flow || []).map((f, i) =>
          (i ? `<span class="info-arr">${sep}</span>` : '') + `<span class="info-b">${f}</span>`).join('');
        return `<div class="info-mini"><div class="info-mh">${iconSvg(c.icon)}<span>${c.title}</span></div>`
          + `<div class="info-flow">${flow}</div>${c.note ? `<p>${c.note}</p>` : ''}</div>`;
      }).join('')
    + '</div>';
}

function renderBanner(b){
  const bk = b.icon ? `<span class="info-bk">${iconSvg(b.icon)}</span>` : '';
  return `<div class="info-banner">${bk}<div>${b.html}</div></div>`;
}

function renderBlock(b){
  switch(b.type){
    case 'attrs':  return renderAttrs(b);
    case 'icons':  return renderIcons(b);
    case 'steps':  return renderSteps(b);
    case 'flows':  return renderFlows(b);
    default:       return '';
  }
}

export function renderInfographic(spec){
  if(!spec) return '';
  const accent = spec.accent || 'var(--tema-accent)';
  const head = '<div class="info-head">'
    + (spec.illus ? `<div class="info-illus">${spec.illus}</div>` : '')
    + (spec.eyebrow ? `<div class="info-eyebrow">${spec.eyebrow}</div>` : '')
    + `<div class="info-title">${spec.title || ''}</div>`
    + (spec.sub ? `<div class="info-sub">${spec.sub}</div>` : '')
    + '</div>';

  let k = 0;
  const parts = [head];
  for(const raw of (spec.blocks || [])){
    if(raw.type === 'banner'){ parts.push(renderBanner(raw)); continue; }
    if(raw.type === 'rule'){ parts.push('<div class="info-rule"></div>'); continue; }
    let b = raw;
    if(b.title && b.n == null){ k++; b = Object.assign({}, b, { n: String(k).padStart(2, '0') }); }
    parts.push('<div class="info-rule"></div>');
    parts.push(renderBlock(b));
  }
  const tag = spec.tag ? `<div class="info-tag">${spec.tag}</div>` : '';
  const label = esc(spec.aria || spec.title || 'Infografía resumen');
  const sr = esc(spec.srSummary || spec.aria || spec.title || '');

  return `<section class="info reveal" style="--info-accent:${accent}" role="img" aria-label="${label}">`
    + (sr ? `<h2 class="info-sr">${sr}</h2>` : '')
    + '<div class="info-topbar"></div>'
    + `<div class="info-pad">${parts.join('')}${tag}</div>`
    + '</section>';
}

/* Monta la infografía en un contenedor ya existente del template del tema. */
export function renderInfographicInto(el, spec){
  if(el) el.innerHTML = renderInfographic(spec);
}
