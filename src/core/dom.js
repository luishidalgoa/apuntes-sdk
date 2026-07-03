/* Utilidades DOM mínimas compartidas. */

export function esc(s){
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Los filtros "crayon" que usan todas las ilustraciones SVG de los temas.
   Se montan UNA vez en el shell (en los HTML viejos cada página tenía copia). */
export const CRAYON_FILTERS = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="crayon" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="crayon2" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="24" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.0" xChannelSelector="R" yChannelSelector="G"/></filter>
</defs></svg>`;
