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

#### La clave (`data-mark-id`) es la IDENTIDAD de la tarjeta

Bajo esa clave el navegador del usuario guarda **su importancia, su prioridad en
el plan de estudio y sus subrayados**. No es un texto decorativo: es un
identificador. De ahí la única regla que importa:

> **Cambiar la clave = perder lo que el usuario había marcado ahí.** No hay
> error, no hay aviso en pantalla: la tarjeta simplemente reaparece virgen.

Lo peligroso es derivar la clave del **título**, porque entonces renombrar la
tarjeta —algo que parece puramente editorial— cambia su identidad. Ocurrió de
verdad: «Software de E/S y técnicas» pasó a «Técnicas de E/S» y la marca del
usuario se quedó huérfana bajo la clave vieja.

Si tu tema está escrito a mano, deja que el SDK ponga claves y anclas:

```js
import { assignCardKeys } from 'apuntes-sdk';

renderContent(el){
  el.innerHTML = MI_HTML;
  assignCardKeys(el);   // clave + ancla `sec-<clave>` en cada tarjeta
  numerarEsquema(el);
}
```

> **Si tu tema ya publica anclas, díselo antes de adoptar el helper.** También
> pone el ancla del `.node`, con el `anchorPrefix` de la app, que es **uno para
> toda ella**: si tus tarjetas publican `sec-…` y la app está en `art-`,
> adoptarlo tal cual **renombra tus anclas en silencio** y rompe los deep-links y
> marcadores guardados.
> ```js
> assignCardKeys(el, { anchorPrefix: 'sec-' });   // tu prefijo
> assignCardKeys(el, { anchor: false });          // solo claves; las anclas las pones tú
> ```

#### El ancla no es la clave: elige de dónde sale (`anchorFrom`)

La clave se **congela** al renombrar (para no perder las marcas) y el ancla puede
querer **seguir al título de hoy** (para que la URL diga lo que la tarjeta dice).
En una tarjeta renombrada divergen, y hay que elegir — ninguna opción es gratis:

| `anchorFrom` | Qué gana | Qué cuesta |
|---|---|---|
| `'key'` *(por defecto)* | el ancla **no cambia** al renombrar: deep-links y marcapáginas guardados siguen valiendo | la URL arrastra el nombre viejo |
| `'title'` | URL legible, acorde al título actual | cada renombrado **deja sin efecto el marcapáginas** de esa tarjeta (se guarda por id de ancla; al no encontrarlo no restaura posición, en silencio) |
| `(card, key) => id` | lo que no cubran las anteriores | tuyo |

**`anchorFrom: 'title'` slugifica con el `slugify` que le pases**, no con el del
SDK. Si tu tema tiene el suyo —porque su materia genera títulos que el genérico
no distingue—, pásaselo y el ancla saldrá bien:

```js
assignCardKeys(el, { slugify, anchorPrefix: 'sec-', anchorFrom: 'title' });
```

Importa más de lo que parece: con el `slugify` genérico, «Árbol B+» da `arbol-b`,
que ya ocupa «Árbol B», así que la guarda de ids libres la salta y **la tarjeta
se queda sin ancla y sin deep-link**, en silencio. Con un `slugify` que convierta
el `+` antes de barrer lo no alfanumérico, conviven `sec-arbol-b` y
`sec-arbol-b-plus`. Medido sobre 169 anclas reales: **0 diferencias, 0 sin ancla**.

Para lo que **ningún `slugify` puede resolver** —el renombrado, donde el título
de hoy ya no es el de ayer— la tarjeta puede **declarar su ancla** con
`data-anchor-id`, igual que declara su clave. Lo declarado siempre manda:

```html
<!-- Se llamaba «Software de E/S y técnicas». La clave salva las marcas;
     el ancla, el marcapáginas y los deep-links. Son dos identidades. -->
<div class="card c1"
     data-mark-id="software-de-e-s-y-tecnicas"
     data-anchor-id="sec-software-de-e-s-y-tecnicas">
```

> **Al renombrar una tarjeta publicada, conserva las DOS.** `data-mark-id` salva
> la importancia y la prioridad; `data-anchor-id`, el marcapáginas y los enlaces.
> Conservar solo la primera deja el renombrado a medias, y la mitad que falta
> falla en silencio.

`assignCardKeys` **respeta la clave que la tarjeta declare** y solo cae al slug
del título cuando no hay ninguna. Así que **al renombrar una tarjeta, clávale su
clave vieja en el HTML** y no se pierde nada:

```html
<!-- Se llamaba «Software de E/S y técnicas»: la clave se queda como estaba -->
<div class="card c1" data-mark-id="software-de-e-s-y-tecnicas">
  <div class="card-head"><div class="body">
    <div class="row1"><span class="name">Técnicas de E/S</span></div>
```

Es fea, y esa fealdad es correcta: la clave es historia, no título. Sirve
igual para **desempatar dos títulos que slugifican igual** («Árbol B» y
«Árbol B+» dan los dos `arbol-b`, y compartirían marca).

> **Si tu tema va por datos + `renderCard`** (el camino recomendado), no tienes
> este problema: la clave sale del número de artículo o del numeral, no del
> título, así que renombrar no la toca. Solo si algún día cambia el **numeral**
> de una tarjeta ya publicada, consérvale la identidad con `markId` en su dato:
> ```js
> { sig: '4.2', markId: '4.1', name: 'Órganos de gobierno', … }   // era la 4.1
> ```

**Si montas las tarjetas a mano, asigna la clave solo cuando no la haya.** Un
`card.setAttribute('data-mark-id', slug(titulo))` incondicional pisa en el render
la clave que acabas de conservar en el HTML, y la convención deja de funcionar
sin que nada lo avise. Usa `assignCardKeys`, que ya lo hace bien, o replica su
regla: `el.getAttribute('data-mark-id') || slug(titulo)`.

`apuntes-verify` vigila las dos caras: da **error** si dos tarjetas comparten
clave, y **aviso** cuando una clave que existía desaparece (el síntoma de un
renombrado). Para lo segundo mantiene `.apuntes-claves.json` en la raíz de la
app: **commitéalo**, es la memoria de qué claves había.

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

**Patrón recomendado — UN glosario por materia, compartido:** no repitas las
siglas en cada tema. Mantén un solo fichero por materia e impórtalo:

```js
// src/glosario.js  (o materia-glossary.js si hay varias materias)
export const GLOSARIO = { ADN: 'Ácido desoxirribonucleico', ARNm: 'ARN mensajero' };

// en cada tema de esa materia:
import { GLOSARIO } from '../../glosario.js';
export default { …, glossary: GLOSARIO, renderContent(el){ … } };
```

Va por materia y **no** en `appConfig` global precisamente para que dos materias
puedan dar significados distintos a la misma sigla.

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
> estudiable, envuélvelo en una tarjeta con `data-mark-id` (o llama a
> `assignCardKeys(el)` y deja que el SDK lo ponga, §3.3); si es una sección,
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

**Dos sabores** (`preset`), mismo motor y distinto lenguaje:

| `preset` | Botones | Para |
|---|---|---|
| `'player'` *(por defecto)* | ▶ · ⏭ Paso · ↺ · contador `n/N` | **trazas y algoritmos**: se reproduce y se observa |
| `'deck'` | ‹ Anterior · Siguiente › · dots | **diapositivas**: se explica un concepto escena a escena |

```js
mountStepper(host, { steps: ESCENAS, render, narrate, preset: 'deck' });   // 4 líneas
```
En `deck` arranca ya en la primera escena, «Anterior» se deshabilita al principio
y «Siguiente» se vuelve «↺ Otra vez» al final. Puedes ajustar cualquier etiqueta
suelta con `labels: { step: '…' }`.

> ### Cuándo montar una diapositiva en vez de escribir otro párrafo
> Es la pregunta importante, y la respuesta no es "cuando quede bonito". Usa un
> stepper cuando el concepto **cambia con el tiempo o con los pasos**, porque la
> prosa obliga al lector a simular ese cambio en su cabeza:
> - **Una secuencia o un protocolo** (qué pasa primero, qué después).
> - **Una traza**: un algoritmo, un autómata, una petición atravesando capas.
> - **Un antes/después** que solo se entiende comparando (la misma escena que
>   acaba bien y mal según una decisión).
> - **Una causa encadenada**: por qué A provoca B provoca C.
>
> **No lo uses** para una clasificación, una definición o una comparación
> estática: eso es una tabla o una tarjeta, y una diapositiva solo lo entierra
> detrás de clics. Si al escribir el paso 2 no cambia nada respecto al 1, no era
> un stepper.

**Opciones de `controls`**: `play`, `step`, `back`, `reset` (booleanos),
`speed` (número fijo · array `[{ms,label}]` → `<select>` · `{min,max}` → slider),
`position` (`'counter'` · `'dots'` · `false`), `idleIndex` (`-1` arranca en
reposo, `0` arranca en el primer paso).

**Devuelve un controlador**: `.reload(nuevosPasos)` (cuando cambie un control de
dominio tuyo), `.goTo(n)`, `.destroy()`.

> Los **controles de dominio** (elegir algoritmo, cambiar la entrada, nº de
> marcos…) los montas **tú** en el tema; cuando cambien, llama a `.reload()`.
> El stepper solo se encarga del transporte (▶ ⏭ ‹ ↺).

**Para animar el movimiento entre pasos, `transition` NO sirve.** `render()`
regenera la escena entera, así que en cada paso el elemento es **nuevo**: no hay
valor anterior del que transicionar y el navegador lo pinta ya en su sitio. Lo
que sí corre al crearse un elemento es una **animación**. Pasa las dos posiciones
como custom properties en línea y anímalas con `@keyframes`:

```js
render: ({ step }) =>
  `<line class="aguja" style="--x0:${xDe(step.desde)}px;--x1:${xDe(step.hasta)}px" … />`
```
```css
.aguja{ animation: desliza .5s ease both; }
@keyframes desliza{ from{ x: var(--x0); } to{ x: var(--x1); } }
@media (prefers-reduced-motion: reduce){ .aguja{ animation: none; } }
```
Lo animado es `x`; las custom properties solo aportan los extremos, así que no
hace falta registrarlas con `@property`. Respeta siempre `prefers-reduced-motion`.

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
| Renombras una tarjeta y **pierde la marca del usuario** | la clave salía del título | clávale la clave vieja: `data-mark-id="<clave vieja>"` (§3.3) |
| Marcar una tarjeta marca **otra** a la vez | dos títulos slugifican igual | dale clave propia a una de las dos |
| Una narración sale entera mal, o se come el texto de delante | ternario concatenado a un string: `'de ' + a ? x : y` se agrupa como `('de '+a) ? x : y`, y `'de '+a` es siempre cierto | paréntesis SIEMPRE: `'de ' + (a ? x : y)`, o sácalo a una variable |
| El movimiento entre pasos no se anima | `transition` sobre un elemento que `render()` acaba de recrear | `@keyframes` con las posiciones en custom properties (§10.1) |

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
| **dos tarjetas con la misma clave** | comparten marca, prioridad y subrayados |
| **una clave que desaparece** | un renombrado deja huérfano lo que el usuario marcó |
| glosario: claves <2 letras o muertas | se ignoran en silencio |
| examen: `correcta` fuera de `respuestas`, ids repetidos | preguntas rotas |
| **respuestas contaminadas** (acaban en un nombre de apartado) | basura del PDF arrastrada al importar |

Aun así, **mira estas con el tema abierto** (lo que ninguna herramienta ve):

Y comprueba, con el tema abierto en el navegador:

- [ ] **Renderiza**: el tema se ve entero, sin huecos ni errores en consola.
- [ ] **Ids únicos**: ninguna `id` repetida en la página.
- [ ] **Buscador**: busca una palabra que solo esté en tu tema → aparece, con el
      título y el contexto correctos.
- [ ] **Plan de estudio**: tu tema muestra su jerarquía (secciones y puntos), y
      cada nodo se puede priorizar.
- [ ] **Marcador**: puedes marcar prioridad en una tarjeta y persiste al recargar.
- [ ] **Si has renombrado una tarjeta ya publicada**: lleva su clave vieja en
      `data-mark-id` (si no, el usuario pierde lo que tuviera marcado ahí).
- [ ] **Deep-link**: `#/tema/<id>/<ancla>` abre y hace scroll al sitio correcto.
- [ ] **Examen**: tus preguntas salen, la correcta puntúa y la explicación se lee.
- [ ] **Glosario**: la materia tiene su glosario compartido y el tema lo importa
      (`glossary: GLOSARIO`); los acrónimos salen subrayados y al **clicarlos**
      aparece el rótulo. `verify` avisa si el tema tiene siglas pero no glosario.
- [ ] **Móvil**: a 375 px no hay desbordamiento horizontal.

> ⚠️ **Antes de dar por malo un resultado, comprueba QUÉ código se está sirviendo.**
> El dev server puede estar sirviendo una versión cacheada y verás el fallo ya
> corregido (o al revés). Si algo no cuadra con lo que acabas de editar:
> `rm -rf node_modules/.vite` y reinicia el servidor. Es un falso negativo muy
> caro: parece que tu arreglo no funciona cuando sí lo hace.
>
> La variante mala: **tras subir la versión del SDK**, el pre-bundle viejo sigue
> cacheado y un import del export nuevo casca con
> `SyntaxError: … does not provide an export named 'xxx'`. El síntoma **acusa al
> SDK recién publicado** y no es suyo: mismo arreglo, `rm -rf node_modules/.vite`.

#### Verificar con un panel de navegador oculto

Si el panel del navegador no está a la vista, **la página no compone frames**, y
eso rompe tres cosas de golpe — todas con el mismo disfraz: parecen defectos del
contenido que acabas de escribir.

| Síntoma | Qué pasa de verdad |
|---|---|
| El *screenshot* expira | Sin frames no hay imagen. **Mide el DOM en su lugar**: para verificar estructura y estado es más fiable que una captura. |
| `innerWidth`/`innerHeight` a **0**, anchos absurdos | Sin viewport, toda medida de geometría es basura. Fija el tamaño explícito (`{width:1280, height:900}`) y **comprueba `innerWidth > 0` antes de medir**. |
| Un valor animado se queda en su estado inicial (`max-height: 0`) | La transición nunca avanza. **Comprueba el ESTADO** —clases, `aria-expanded`, existencia de nodos—, no el valor que la animación debería haber cambiado. |

Dos reglas que ahorran el rato:
- **Si el mismo síntoma aparece en TODAS las tarjetas**, es el entorno, no tu
  cambio.
- **`getComputedStyle` sobre un nodo desconectado devuelve vacío**: tras un clic
  que re-renderiza, vuelve a consultar el DOM antes de medir.

Y una clase transitoria (el `flash` del aterrizaje de un deep-link vive ~300 ms)
hay que muestrearla **pronto**: medida a 1,5 s da `false` y parece que no ocurre.

Si alguna falla, es casi seguro un incumplimiento del contrato (§3) — repasa §11.

---

## 13. Plantilla mínima para empezar

Copia [`examples/starter/src/temas/tema1/index.js`](../examples/starter/src/temas/tema1/index.js)
y sustituye el contenido. Es un tema completo y válido: úsalo como esqueleto en
vez de partir de cero.
