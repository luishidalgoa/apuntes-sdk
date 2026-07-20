# SKILL · Crear un tema con `apuntes-sdk`

> **Para quien lee esto: eres una IA construyendo UN tema de estudio.**
> Tu entrada es material docente (un PDF, apuntes, un temario). Tu salida es un
> **manifiesto de tema**: una carpeta `src/temas/<id>/` con un `index.js` que
> exporta por defecto un objeto. No necesitas conocer el resto del SDK.
>
> Este documento es **autosuficiente y normativo**: si algo no está aquí, no lo
> inventes — usa el *escape hatch* (§10) o pregunta.

---

## 0. La regla de oro

El SDK no lee tus datos: **lee el DOM que produces**. Buscador, plan de estudio,
marcador de prioridad, marcapáginas, subrayado, glosario y deep-links funcionan
**todos** reconociendo unas clases e `id` concretos.

> **Si respetas el contrato DOM (§3), todas esas funciones aparecen solas.
> Si te lo saltas, tu tema se renderiza "bien" pero queda mudo: no se busca, no
> se prioriza, no sale en el plan de estudio.**

Esto ya ha pasado de verdad: un tema escrito a mano usó `.label` en vez de
`.name` y **desapareció del buscador**; otro puso el número en un sitio distinto
y **el plan de estudio lo mostró sin numerar**. Ver §11 (errores reales).

---

## 1. Elige el camino: datos + helpers (recomendado)

Hay dos formas de producir el contenido. **Empieza siempre por la primera.**

| | Camino A — **datos + helpers** | Camino B — HTML a mano |
|---|---|---|
| Cómo | Declaras datos y llamas a `renderCardTreesInto` | Escribes el HTML tú |
| Tamaño | ~150 líneas por tema | 600–4.000 líneas |
| Contrato DOM | **Garantizado por el SDK** | Tuya la responsabilidad |
| Cuándo | **Por defecto, el 90%** | Solo lo que A no cubre (§10) |

El ejemplo vivo del camino A es [`examples/starter`](../examples/starter): un
tema completo (contenido + examen + minijuegos) en ~130 líneas. **Cópialo y
sustituye el contenido.** Es la forma más rápida y la que menos falla.

---

## 2. El manifiesto — `src/temas/<id>/index.js`

Exporta por defecto un objeto con estos campos:

```js
export default {
  // ── Identidad (obligatorio) ────────────────────────────────
  id: 'bio-tema1',            // único en toda la app; usado en la URL #/tema/<id>
  titulo: 'La célula',        // título corto
  k: 'Tema 1 · La célula',    // "kicker": cómo se lista en menús y buscador
  descripcion: 'Estructura procariota y eucariota, orgánulos y división celular.',

  // ── Presentación ───────────────────────────────────────────
  numeral: 'I',               // se pinta en la tarjeta del hub (número o símbolo)
  accent: 'var(--t1)',        // color del tema; SIEMPRE una var de tu palette.css (§9)
  headerHtml: `<p class="eyebrow">Biología · Tema 1</p>
    <h1>La <em>célula</em></h1>
    <p class="lede">Unidad estructural y funcional de los seres vivos.</p>`,

  // ── Navegación ─────────────────────────────────────────────
  materia: 'biologia',        // opcional: agrupa temas en el hub (1er nivel)
  bloque: 'Citología',        // opcional: agrupa DENTRO de la materia
  chips: [                    // saltos rápidos a secciones de esta página
    { cls: 'c1', anchor: 'estructura', label: 'Estructura' }
  ],

  // ── Contenido ──────────────────────────────────────────────
  engine,                     // §4
  renderContent(el){ ... },   // §5 — pinta el cuerpo dentro de `el`

  // ── Extras (opcionales) ────────────────────────────────────
  questions,                  // §7 examen
  games,                      // §8 minijuegos
  glossary: { ADN: 'Ácido desoxirribonucleico' },   // §6
  bloques: ['Citología']      // etiquetas de bloque para el examen
};
```

**Obligatorios**: `id`, `titulo`, `k`, `descripcion`, `engine`, `renderContent`.
Todo lo demás degrada con elegancia si falta.

---

## 3. EL CONTRATO DOM (lo más importante)

Cada pieza que pintes debe tener **esta forma exacta**. La columna "lo activa"
dice qué función del SDK depende de ella.

### 3.1 Sección → `.band` con `id`

```html
<div class="band b-estructura reveal" id="estructura">
  <div class="rom">1</div>
  <div>
    <div class="k">De qué está hecha</div>
    <h2>Estructura celular</h2>
    <div class="sub">Membrana, citoplasma y material genético.</div>
  </div>
</div>
```

| Parte | Obligatorio | Lo activa |
|---|---|---|
| `class="band"` | sí | buscador, plan de estudio |
| **`id="…"`** | **sí** | plan de estudio (agrupa), deep-links, prioridad |
| `.rom` | no | numeral que se muestra |
| `.k` | no | "kicker" (se indexa como contexto) |
| `<h2>` | **sí** | **el título** en buscador y plan de estudio |
| `.sub` | no | subtítulo (se indexa) |

> Una banda **sin `id`** no agrupa nada en el plan de estudio ni es priorizable.
> Ponle `id` **siempre**.

### 3.2 Apartado (nivel por encima de la sección) → `.apartado-head` con `id`

Úsalo solo si tu tema tiene dos o más grandes bloques hermanos.

```html
<div class="apartado-head reveal" id="ap-citologia">
  <span class="apn">Apartado 1</span>
  <h2>Citología</h2>
  <p class="apsub">La célula como unidad.</p>
</div>
```

Jerarquía completa que entiende el plan de estudio:
**Materia › Bloque › Tema › Apartado › Sección(banda) › Tarjeta/Artículo**

### 3.3 Tarjeta → **usa el helper** (no la escribas a mano)

```js
import { renderCardTreesInto } from 'apuntes-sdk';

const CARDS = [
  { sig: '1.1',                       // numeral corto (o un emoji)
    name: 'Membrana plasmática',      // título
    desc: 'Bicapa <b>lipídica</b> que delimita la célula.',
    truco: 'Mosaico fluido = lípidos + proteínas móviles',
    illus: '<svg viewBox="0 0 60 60">…</svg>',   // opcional
    artNums: ['membrana']             // opcional: claves de engine.sections a desplegar
  }
];

renderCardTreesInto(el, engine, [
  { containerId: 'tree-estructura', cards: CARDS, cls: 'c1' }
]);
```

El helper produce el DOM correcto, incluido **`data-mark-id`** (sin él la
tarjeta no es priorizable, ni buscable, ni sale en el plan):

```html
<div class="node reveal">
  <div class="card c1" data-mark-id="membrana">
    <div class="card-head"><div class="body">
      <div class="row1"><span class="sig">1.1</span><span class="name">Membrana plasmática</span></div>
      <p class="desc">…</p>
      <p class="truco"><span class="bulb">💡</span><span>…</span></p>
    </div><div class="illus">…</div></div>
    <!-- si hay artNums: --> <button class="disclosure">…</button>
    <div class="det"><div class="det-inner">…</div></div>
  </div>
</div>
```

> **Si escribes una tarjeta a mano** (evítalo): el número va en `.sig` y el
> título en `.name`, **hermanos** dentro de `.row1`. Y **`data-mark-id` es
> obligatorio**. No uses `.label` (el buscador la ignoraba) ni metas el número
> dentro de `.name`.

### 3.4 Artículo / punto con texto fuente → `renderArticleBlock`

Para material normativo o cualquier texto con apartados numerados citables.
Produce `.art-block[id]` con `.art-num` + `.art-title`, indexado **a nivel de
artículo** por el buscador.

### 3.5 Contenedor de tarjetas

Tu plantilla debe declarar el hueco donde el helper inyecta:

```html
<div class="tree" id="tree-estructura"></div>
```

---

## 4. `engine` — el contenido citable

```js
const SECTIONS = {                       // lo que se ve al desplegar una tarjeta
  membrana: { title: 'Membrana plasmática', apartados: [
    { n: 1, text: 'Bicapa lipídica con proteínas embebidas.' },
    { n: 2, text: 'Regula el intercambio con el medio.', refs: [{ t: 'ósmosis', r: 'transporte' }] }
  ] },
  nucleo: { title: 'Núcleo', text: 'Contiene el material genético.' }
};

const SOURCE = {                         // texto literal (se abre al pulsar el nº)
  membrana: { title: 'Membrana plasmática', paragraphs: [
    { n: 1, text: 'La membrana plasmática es una bicapa lipídica…' }
  ] }
};

const engine = {
  sections: SECTIONS,
  source: SOURCE,                        // {} si no tienes texto literal
  labelFor: (k) => (SECTIONS[k] ? SECTIONS[k].title : k),
  keySplit: 'first',
  specialTags: {}                        // opcional: píldoras destacadas
};
```

Si tu tema **no** tiene texto citable (contenido curado sin fuente literal),
usa el contrato neutro: `{ sections: {}, source: {}, labelFor: k => k, keySplit: 'first' }`.

**Enumeraciones dentro de un párrafo**: escribe el texto tal cual
(`…criterios: a) … b) … c) …`). El SDK detecta letras y ordinales consecutivos y
los pinta como lista indentada. No los partas tú.

---

## 5. `renderContent(el)`

```js
renderContent(el){
  el.innerHTML = TEMPLATE;                       // bandas + contenedores vacíos
  renderCardTreesInto(el, engine, [              // rellena los contenedores
    { containerId: 'tree-estructura', cards: CARDS, cls: 'c1' }
  ]);
}
```

Reglas:
- **Idempotente**: se llama en cada render; no acumules estado global.
- **Nada de `document.*` global fuera de `el`**: trabaja dentro del nodo recibido.
- **Nunca toques `localStorage`/`window` en el cuerpo del módulo** (fuera de
  funciones): rompe las herramientas de línea de comandos (§11).

---

## 6. Glosario de acrónimos

```js
glossary: { ADN: 'Ácido desoxirribonucleico', ARNm: 'ARN mensajero' }
```

Declaralo **por tema** (no global) para evitar colisiones entre materias
(p.ej. `IT` significa cosas distintas en dos asignaturas).

**Reglas del matcher — si no las cumples, la clave se ignora en silencio:**

| Regla | Detalle |
|---|---|
| **Mínimo 2 letras** | `T` o `A` se **descartan**. Solo siglas de 2+ caracteres. |
| **Debe aparecer en la prosa** | Si el acrónimo no está escrito en el texto del tema, no hay nada que envolver. Declararlo no lo "añade". |
| **Mayúsculas exactas** | El matcher distingue: `UA` no casa con `ua`. Usa la grafía real del texto (`AIReF`, `RDLeg`). |
| **Puntos opcionales** | `CCAA` casa también con `CC.AA.` |
| **Solo en el cuerpo** | Se ignoran títulos (`h1`–`h4`), botones, chips, `.k`/`.kicker`, enlaces y código. |

Se activa **al hacer clic** (no al pasar el ratón) y muestra el título.

> Comprobación rápida: busca el acrónimo en tu propio texto antes de declararlo.

---

## 7. Examen — `questions`

```js
const questions = [
  { id: 1,
    bloque: 'Citología',            // agrupa en el filtro del examen
    articulo: 'membrana.1',         // clave de engine.sections → enlaza a la teoría
    pregunta: '¿Qué modelo describe la membrana plasmática?',
    respuestas: ['Mosaico fluido', 'Bicapa rígida', 'Malla proteica', 'Retículo'],
    correcta: 'Mosaico fluido',     // el TEXTO exacto de la respuesta correcta
    explicacion: 'El modelo de mosaico fluido (Singer y Nicolson, 1972).' }
];
```

- `id` único **dentro del tema**.
- `correcta` es el **texto**, no el índice (el SDK baraja las opciones).
- `explicacion` es obligatoria en la práctica: es lo que se estudia al fallar.
- `articulo` es opcional pero muy recomendable: habilita "ir a la teoría".

---

## 8. Minijuegos — `games` *(opcional)*

```js
const games = [
  { id: 'clasifica', ico: '🗂', title: '¿Qué orgánulo?', desc: 'Clasifica cada función.',
    start: (api) => api.playSorting({ title: '…', buckets: [...], items: [...], rounds: 6 }) },
  { id: 'flash', ico: '🃏', title: 'Flashcards', desc: 'Repasa sección a sección.',
    start: (api) => api.startFlashcards() }
];
```

`api.startFlashcards()` funciona **sin configurar nada**: se derivan de
`engine.sections`. Es la forma más barata de añadir repaso.

---

## 9. Reglas de diseño

- **Colores**: solo variables de la paleta (`var(--t1)`, `var(--tema-accent)`).
  **Nunca** un hex a pelo en el contenido — rompe el modo oscuro y la coherencia.
- **Clases de color por sección** (`b-estructura`, `c1`): defínelas en el
  `palette.css` de la app, no con estilos en línea.
- **Jerarquía tipográfica**: la da el SDK. Usa `<h2>` en bandas/apartados y deja
  que el CSS mande; no fijes tamaños.
- `reveal` en bandas y tarjetas activa la animación de entrada.

---

## 10. Escape hatch — cuando los helpers no llegan

Para lo verdaderamente a medida (un simulador, un diagrama interactivo, un
widget) tienes dos vías, en este orden:

1. **Componente del SDK** si existe — mira primero el **catálogo (§10.1)**.
2. **Código propio** en un fichero del tema, montado desde `renderContent`.
   Requisitos: que viva dentro de `el`, que sea idempotente, y que **no toque
   `window`/`localStorage` en el cuerpo del módulo**.

> Al escribir un widget a medida, **no rompas el contrato**: si es contenido
> estudiable, envuélvelo en una tarjeta con `data-mark-id`; si es una sección,
> dale `.band` + `id`.

### 10.1 Catálogo de componentes

| Componente | Para qué | Import |
|---|---|---|
| `renderInfographic(spec)` | Infografía de cierre (recap visual data-driven) | `apuntes-sdk` |
| **`mountStepper(host, spec)`** | **Simulación paso a paso** (algoritmos, autómatas, trazas) | `apuntes-sdk` |
| `mountSteppersAll(root, sel, fn)` | Un stepper por cada host que case (widget repetido) | `apuntes-sdk` |

#### `mountStepper` — motor de pasos

Úsalo **siempre** que quieras "avanzar y ver qué pasa". Tú aportas los datos y
cómo se pinta un paso; **el SDK pone** los controles, el cronómetro, el índice y
sus límites, el contador, la parada automática al salir del tema y el
`aria-live` de la narración.

```js
import { mountStepper } from 'apuntes-sdk';

mountStepper(el.querySelector('[data-widget="orbita"]'), {
  steps: ORBITA,                                        // array de datos (o una función)
  render:  ({ step }) => escenaOrbita(step),            // devuelve HTML → el SDK lo pinta
  narrate: ({ step }) => '<b>' + step.t + '.</b> ' + step.d,
  idleMsg: 'Pulsa ▶ para empezar.',
  controls: { back: true, position: 'dots', speed: 1500 }
});
```

**Dos modos de pintado**, según lo que devuelva `render`:
- **devuelve un string** → el SDK lo vuelca en su contenedor de escena.
- **no devuelve nada** → tú ya pintaste (p.ej. iluminando con clases un SVG que
  ya estaba en la tarjeta). Usa `reset` para limpiar antes de cada paso.

**Opciones de `controls`**: `play`, `step`, `back`, `reset` (booleanos),
`speed` (número fijo · array `[{ms,label}]` → `<select>` · `{min,max}` → slider),
`position` (`'counter'` · `'dots'` · `false`), `idleIndex` (`-1` arranca en
reposo, `0` arranca en el primer paso).

**Devuelve un controlador**: `.reload(nuevosPasos)` (cuando cambie un control de
dominio tuyo), `.goTo(n)`, `.destroy()`.

> Los **controles de dominio** (elegir algoritmo, cambiar la entrada, nº de
> marcos…) los montas **tú** en el tema; cuando cambien, llama a `.reload()`.
> El stepper solo se encarga del transporte (▶ ⏭ ‹ ↺).

**Patrón obligatorio del desplegable**: el botón va **FUERA** de `.det`.

```html
<button class="disclosure"><span class="chev">▸</span> Ver más</button>
<div class="det"><div class="det-inner"> … </div></div>
```
Si metes el `<button>` DENTRO de `.det`, queda **invisible** (el SDK colapsa
`.det` con `max-height:0; overflow:hidden`). Es un error real y recurrente.

---

## 11. Errores reales (todos han ocurrido)

| Síntoma | Causa | Arreglo |
|---|---|---|
| El tema no sale en el buscador | tarjetas con `.label` en vez de `.name` | usa el helper, o `.name` |
| Una tarjeta no se puede priorizar / no sale en el plan | falta `data-mark-id` | añádelo (el helper lo pone) |
| El plan de estudio muestra el punto sin número | número fuera de `.sig`/`.secn` | número en `.sig`, hermano de `.name` |
| Las secciones no agrupan en el plan | `.band` **sin `id`** | pon `id` a cada banda |
| El desplegable no se ve ni se puede pulsar | `<button class="disclosure">` dentro de `.det` | sácalo fuera de `.det` |
| Los scripts de línea de comandos petan | `localStorage`/`window` en el cuerpo del módulo | accede solo dentro de funciones |
| Un artículo no aparece en su tarjeta | la clave no está en `engine.sections` | revisa `artNums` ↔ `sections` |

---

## 12. Checklist de verificación (obligatorio antes de dar por hecho)

No des un tema por terminado sin **ejecutar** esto:

```bash
npm run verify     # audita el contrato de TODOS los temas  ← lo primero
npm run dev        # levanta la app
npm run build      # debe compilar sin errores
```

`npm run verify` comprueba automáticamente casi todo lo de esta sección y te dice
**qué está mal y por qué importa**. Sale con código ≠ 0 si hay errores, así que
sirve en CI. Detecta, entre otros:

| Comprueba | Por qué |
|---|---|
| campos obligatorios del manifiesto | sin ellos el tema no se lista bien |
| **ids duplicados** en un tema | un deep-link aterriza en el sitio equivocado |
| tarjetas sin `data-mark-id` | invisibles al marcador, al buscador y al plan |
| tarjetas sin `.name`/`.label` | el indexador las ignora |
| `.disclosure` dentro de `.det` | el botón queda invisible |
| `.band`/`.apartado-head` sin `id` | no agrupan en el plan de estudio |
| **APIs de navegador al importar** | rompen los scripts de línea de comandos |
| glosario: claves <2 letras o muertas | se ignoran en silencio |
| examen: `correcta` fuera de `respuestas`, ids repetidos | preguntas rotas |

Aun así, **mira estas con el tema abierto** (lo que ninguna herramienta ve):

Y comprueba, con el tema abierto en el navegador:

- [ ] **Renderiza**: el tema se ve entero, sin huecos ni errores en consola.
- [ ] **Ids únicos**: ninguna `id` repetida en la página.
- [ ] **Buscador**: busca una palabra que solo esté en tu tema → aparece, con el
      título y el contexto correctos.
- [ ] **Plan de estudio**: tu tema muestra su jerarquía (secciones y puntos), y
      cada nodo se puede priorizar.
- [ ] **Marcador**: puedes marcar prioridad en una tarjeta y persiste al recargar.
- [ ] **Deep-link**: `#/tema/<id>/<ancla>` abre y hace scroll al sitio correcto.
- [ ] **Examen**: tus preguntas salen, la correcta puntúa y la explicación se lee.
- [ ] **Glosario** (si lo declaraste): los acrónimos salen subrayados y al
      **clicarlos** aparece el rótulo.
- [ ] **Móvil**: a 375 px no hay desbordamiento horizontal.

> ⚠️ **Antes de dar por malo un resultado, comprueba QUÉ código se está sirviendo.**
> El dev server puede estar sirviendo una versión cacheada y verás el fallo ya
> corregido (o al revés). Si algo no cuadra con lo que acabas de editar:
> `rm -rf node_modules/.vite` y reinicia el servidor. Es un falso negativo muy
> caro: parece que tu arreglo no funciona cuando sí lo hace.

Si alguna falla, es casi seguro un incumplimiento del contrato (§3) — repasa §11.

---

## 13. Plantilla mínima para empezar

Copia [`examples/starter/src/temas/tema1/index.js`](../examples/starter/src/temas/tema1/index.js)
y sustituye el contenido. Es un tema completo y válido: úsalo como esqueleto en
vez de partir de cero.
