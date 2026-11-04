/* Relaciones entre artículos (engine.relations). Se declara SOLO el sentido
   «ampliada → ampliadoras»:
     relations: { 'LOPDGDD-13': ['LOPDGDD-12'], 'LOPDGDD-15': ['LOPDGDD-12'] }
   Así 13 y 15 llevan una flecha de entrada (←) hacia 12, y 12 una de salida (→)
   con 13 y 15. La salida se DEDUCE invirtiendo ese mapa: no hay que escribirla.
   El resultado se cachea por objeto (el engine no cambia en ejecución). */

const cache = new WeakMap();

function indexOf(ctx){
  const rel = (ctx && ctx.relations) || null;
  if(!rel) return { ins: {}, outs: {} };
  if(cache.has(rel)) return cache.get(rel);
  const ins = {}, outs = {};
  for(const amp of Object.keys(rel)){
    const padres = [].concat(rel[amp] || []);
    ins[amp] = padres.slice();
    for(const p of padres) (outs[p] || (outs[p] = [])).push(amp);
  }
  const idx = { ins, outs };
  cache.set(rel, idx);
  return idx;
}

/* ← Ampliadoras de esta clave: los artículos que la amplían (entrada). */
export function ampliadorasDe(ctx, key){ return indexOf(ctx).ins[key] || []; }

/* → Ampliadas por esta clave: los artículos que esta amplía (salida, deducida). */
export function ampliadasDe(ctx, key){ return indexOf(ctx).outs[key] || []; }
