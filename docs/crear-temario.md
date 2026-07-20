# Crear un temario con el SDK

Guía para montar una **asignatura nueva** (un "temario") sobre `apuntes-sdk`.

El SDK aporta **todo el núcleo genérico** —shell, router, examen (con tutor IA
opcional), minijuegos, marcapáginas, subrayado, paneles, buscador global y el
sistema de diseño—. Tú solo aportas **tres cosas**: la **configuración** de la
app, una **paleta** de colores y el **contenido** (los temas). El SDK no sabe
nada de tu asignatura: funciona por contrato.

La plantilla viva es [`examples/starter`](../examples/starter) (una demo mínima
del *Sistema Solar*, sin nada de legislación). La forma más rápida de empezar es
**clonarla** y sustituir el contenido.

> **Verificar antes de dar por hecho** — `npm run verify` (lo aporta el SDK como
> `apuntes-verify`) audita el contrato de todos tus temas: ids duplicados,
> tarjetas invisibles al buscador, botones atrapados, APIs de navegador que
> rompen los scripts, glosarios muertos y preguntas mal formadas. Sale con
> código ≠ 0, así que vale para CI. Añádelo a tu `package.json`:
> `"scripts": { "verify": "apuntes-verify" }`

> **Autoría con IA** — para crear **un tema** concreto, usa
> [`SKILL-crear-tema.md`](SKILL-crear-tema.md): es el contrato autosuficiente
> que le pasas a una IA junto con tu material (PDF, apuntes). Este documento que
> estás leyendo cubre el **montaje de la app**; el skill cubre **cada tema**.

> **Nota si trabajas dentro de este repo**: `examples/starter` depende del SDK
> con `file:../..`, que npm resuelve como **symlink**. Por eso el starter necesita
> que el SDK tenga sus propias dependencias instaladas: ejecuta `npm install` en
> la **raíz del SDK** antes de compilar el starter (si no, falla al resolver
> `motion`). Quien instale el SDK desde git no tiene este paso: npm baja esa
> dependencia por él.

---

## 1. Anatomía de una app

```
mi-temario/
  package.json          # dependencia del SDK + scripts (dev / build / release)
  vite.config.js        # empaqueta a un ÚNICO HTML (fuentes + CSS inline, offline)
  index.html
  src/
    main.js             # el arranque: createApp(appConfig, TEMAS)
    palette.css         # los acentos (--colores) de TU asignatura
    registry.js         # reúne y exporta el array TEMAS
    temas/
      tema1/index.js    # un manifiesto por tema
      tema2/index.js
      …
```

El SDK se compila **dentro** del singlefile de la app (Vite +
`vite-plugin-singlefile`): las fuentes y el CSS quedan inlinados y el HTML
resultante funciona por `file://` sin red.

---

## 2. El arranque — `src/main.js`

```js
import 'apuntes-sdk/styles';   // sistema de diseño + fuentes (se inlinan en el build)
import './palette.css';        // los acentos de TU asignatura (--t1, --astro, …)
import { createApp } from 'apuntes-sdk';
import { TEMAS } from './registry.js';

createApp(appConfig, TEMAS);
```

`createApp(appConfig, temas)` inyecta la config, registra los temas, monta el
shell (una vez) y arranca el router hash. **El hub, el examen, las flashcards, el
buscador y los deep-links se generan solos** a partir de `TEMAS`.

---

## 3. `appConfig`

Recoge todo lo que de otro modo estaría hardcodeado. Todos los campos son
opcionales salvo que quieras el comportamiento por defecto.

| Campo | Para qué |
|---|---|
| `title` | Título del hub (`<h1>`). |
| `eyebrow` | Línea superior del hub. |
| `subject` | Nombre de la asignatura (metadatos). |
| `lede` | Párrafo introductorio del hub. |
| `examLede` | Descripción de la tarjeta "Examen". |
| `footer` | Pie del hub. |
| `aiSystemPrompt` | Prompt de sistema del tutor IA del examen (si usas IA). |
| `anchorPrefix` | Prefijo de los `id` de sección y de los deep-links. Por defecto `'sec-'`; usa `'art-'` si necesitas compatibilidad con enlaces antiguos. |
| `externalPrefixes` | Prefijos de referencias a otros temas (p.ej. `['CE-']`). |
| `detailLabel` | `(n) => string` para el botón "desplegar" de la tarjeta. |
| `glossary` | Glosario de **acrónimos** de la asignatura: `{ 'AGE':'Administración General del Estado', … }`. Ver el recuadro de abajo. |

### Glosario de acrónimos

Cada asignatura aporta su `glossary` (acrónimo → título completo). El SDK
**auto-envuelve** las apariciones de esos acrónimos en el contenido de los temas
en un `<abbr class="acro">` clicable; al clicar (o Enter/Espacio) muestra un
**rótulo** con el título completo.

```js
glossary: {
  'AGE':  'Administración General del Estado',
  'CCAA': 'Comunidades Autónomas',    // cubre también 'CC.AA.' (se normaliza la puntuación)
  'EBEP': 'Estatuto Básico del Empleado Público'
}
```

- La **clave** es el acrónimo; el **valor**, el título completo.
- **Lista blanca:** enlaza SOLO contra estas claves. Nunca marca "cualquier
  mayúscula" (p.ej. `NO`, `CONGRESO` en énfasis no se tocan).
- **Puntuación normalizada:** pon `'CCAA'` y también cubre `CC.AA.` (y
  `'AAPP'` ≡ `AA.PP.`); no dupliques variantes.
- **Override por tema:** un tema puede ampliar el glosario con `tema.glossary`
  (se fusiona sobre el global) para siglas que solo salen en ese tema.
- No hay que tocar nada más: el SDK excluye títulos/enlaces/refs/chips/SVG, es
  idempotente y no altera la búsqueda ni el subrayado.

---

## 4. El registro — `src/registry.js`

```js
import tema1 from './temas/tema1/index.js';
import tema2 from './temas/tema2/index.js';

export const TEMAS = [tema1, tema2];
```

El **orden** de este array manda: es el orden de los temas en el hub y en el
desplegable, y —si usas la capa `bloque` (§6)— el orden en que aparecen los
bloques.

---

## 5. El manifiesto de un tema — `src/temas/temaN/index.js`

Cada tema exporta por defecto un objeto con este contrato. **Obligatorio** salvo
que se marque *(opcional)*.

### Identidad y cabecera

```js
export default {
  id: 'tema1',                      // identificador único (usado en la URL #/tema/<id>)
  numeral: 'I',                     // lo que sale en el círculo grande del hub (número, romano, emoji…)
  k: 'Tema 1 · CE arts. 10–65',     // "kicker": el nº real del tema se saca de aquí (regex /Tema (\d+)/)
  titulo: 'Título I y Título II',   // título del tema
  descripcion: 'Los derechos…',     // descripción (hub)
  accent: 'var(--t1)',              // color de acento del tema (de tu palette.css)
  headerHtml: `<p class="eyebrow">…</p><h1>…</h1><p class="lede">…</p>`,  // cabecera de la página
  hintHtml: 'Despliega para ver…',  // (opcional) pista bajo la barra de controles
  chips: [                          // (opcional) saltos de sección ("En esta página") + resumen en el desplegable
    { cls: 'a-transp', anchor: 'tree-ti', label: 'Transparencia' }
  ],
  bloque: 'Bloque 1',               // (OPCIONAL) capa de agrupación — ver §6
  engine,                           // el contenido (ver §7)
  renderContent(el){ … },           // pinta el cuerpo (ver §8)
  games,                            // (opcional) minijuegos (ver §9)
  questions,                        // preguntas de examen (puede ser []) (ver §10)
  apartados: ['Título I', 'Título II'],  // sub-bloques de EXAMEN del tema (ver §10)
  glossary: { 'AGE': 'Administración General del Estado' }  // (OPCIONAL) amplía el glosario solo aquí (§3)
};
```

> **Aviso de nombres** (se parecen, son cosas DISTINTAS):
> - `bloque` (singular, §6) = capa que agrupa varios **temas** (navegación).
> - `apartados` (plural, §10) = sub-bloques de **examen** dentro de un tema, para
>   filtrar preguntas (`q.apartado` en cada pregunta). Desde SDK v0.1.25 se llaman
>   `apartados`/`apartado`; los nombres antiguos `bloques`/`bloque` siguen aceptados
>   (retrocompatible), pero usa los nuevos.
> - No confundir con los `apartados` de un **artículo** (`sections.<clave>.apartados
>   = [{n,text}]`, los puntos numerados del texto): mismo nombre, otro nivel.

---

## 6. La capa `bloque` — **opcional**

Agrupa varios temas bajo una etiqueta común («Bloque 1», «Bloque 2»…), una capa
por **encima** del tema. Es **totalmente opcional y aditiva**:

- Un tema la activa declarando `bloque: 'Bloque 1'` (una etiqueta) o
  `bloque: { id: 'b1', label: 'Bloque 1' }`.
- **Si NINGÚN tema declara `bloque`, no pasa nada**: el hub es una lista plana, el
  buscador no muestra migas de bloque y el examen no añade ese nivel. 100%
  retrocompatible.
- Si la usas, aparece **automáticamente** en las cuatro superficies:
  - **Hub**: los temas se agrupan bajo cabeceras de bloque.
  - **Buscador**: las migas incluyen el bloque (`Bloque 1 › Tema 4 › …`) y el
    nombre del bloque es buscable (encuentra sus temas).
  - **Examen**: cabecera de bloque con un checkbox que marca/desmarca todos sus
    temas.
  - **Desplegable de Temas**: los temas se listan bajo su bloque.

Úsala solo si tu temario se organiza en bloques. El SDK no hardcodea ninguna
etiqueta: agrupa por lo que declaren los manifiestos (helpers `bloqueOf`,
`hasBloques`, `groupedTemas` en el registry).

---

## 7. El contenido — `engine`

```js
const engine = {
  sections,             // mapa de "secciones" (el esquema condensado que se muestra en tarjetas)
  source,               // (opcional) el "texto fuente" literal, que se abre al pulsar el número
  labelFor: (k) => …,   // clave → etiqueta ('Art. 97', 'El Sol', …)
  keySplit: 'first',    // 'first' | 'last': por qué punto se parte la clave 'X.Y' en artículo/apartado
  specialTags,          // (opcional) etiquetas especiales del tema (§ abajo)
  sourceDigitFallback,  // (opcional) para claves con letra (20.1a → párrafo 1 del texto fuente)
  external              // (opcional) refs cruzadas a otros temas — ver §11
};
```

**`sections`** — cada clave es un punto del esquema. Dos formas:

```js
const SECTIONS = {
  sol:  { title: 'El Sol', text: 'Estrella de tipo G…' },              // texto único
  luna: { title: 'La Luna', apartados: [                              // con apartados numerados
    { n: 1, text: 'Único satélite natural de la Tierra.' },
    { n: 2, text: 'Provoca las mareas junto al Sol.',
      refs: [{ t: 'el Sol', r: 'sol' }],   // referencia interna: enlaza "el Sol" a la sección 'sol'
      tags: ['dato'] }                     // etiqueta especial (ver specialTags)
  ] }
};
```

**`source`** *(opcional)* — el texto literal que se despliega al pulsar el número
de un artículo/sección:

```js
const SOURCE = {
  luna: { title: 'La Luna', paragraphs: [
    { n: 1, text: 'La Luna es el único satélite natural de la Tierra.' },
    { n: 2, text: 'Su influencia gravitatoria produce las mareas.' }
  ] }
};
```

**`specialTags`** *(opcional)* — el tema define sus propias etiquetas; el SDK no
conoce ninguna concreta:

```js
const SPECIAL_TAGS = {
  dato: { pill: '★ Dato clave', text: 'Cifra que conviene memorizar.', chip: 'clave', icon: '★' }
};
```

---

## 8. Pintar el cuerpo — `renderContent(el)`

Rellena el `<div>` del tema. Escribe una plantilla con **bandas** (`.band`) y
contenedores, y deja que los helpers del SDK monten las tarjetas/secciones y las
infografías:

```js
import { renderCardTreesInto, renderInfographicInto } from 'apuntes-sdk';

const TEMPLATE = `
  <div class="band b-astro reveal">
    <div class="rom">☉</div>
    <div><div class="k">Demo · 3 secciones</div><h2>El sistema solar</h2>
    <div class="sub">Sol, Luna y Tierra…</div></div>
  </div>
  <div class="tree" id="tree-astro"></div>`;

renderContent(el){
  el.innerHTML = TEMPLATE;
  renderCardTreesInto(el, engine, [
    { containerId: 'tree-astro', cards: CARDS, cls: 'a-astro' }
  ]);
  // renderInfographicInto(el.querySelector('#info-x'), MI_INFOGRAFIA);  // (opcional) recap visual de cierre
}
```

Cada **tarjeta** (`CARDS`) apunta a una o varias secciones por su clave:

```js
const CARDS = [
  { sig: '☀️', name: 'El Sol', artNums: ['sol'],
    desc: 'La <b>estrella</b> central del sistema.',
    truco: 'El 99,8% de la masa está en el Sol',
    illus: '<svg viewBox="0 0 60 60">…</svg>' }   // ilustración propia (SVG inline)
];
```

Helpers de render disponibles: `renderCardTreesInto` (tarjetas curadas, el patrón
recomendado), `renderSectionsInto` (secciones en plantilla estática),
`renderArtRow`, `renderCard`, `linkify`, `specialTagChip`, `renderInfographicInto`.

---

## 9. Minijuegos — `games` *(opcional)*

Cada juego se registra con un `start(api)`. La API trae dos juegos genéricos
listos —clasificación y flashcards— y admite juegos **propios**:

```js
const games = [
  { id: 'clasifica', ico: '🗂', title: '¿Qué tipo de cuerpo?', desc: '…',
    start: (api) => api.playSorting({
      title: '¿Qué tipo de cuerpo?',
      buckets: [{ key: 'estrella', label: 'Estrella' }, …],
      items: [{ prompt: 'Concentra el 99,8% de la masa', correctKey: 'estrella' }, …],
      rounds: 6 }) },
  { id: 'flash', ico: '🃏', title: 'Flashcards', desc: 'Repasa las secciones.',
    start: (api) => api.startFlashcards() }
];
```

Para un juego a medida, `start(api)` puede montar tu propio componente (recibe el
contenedor y utilidades del SDK).

---

## 10. Examen — `questions` y `apartados`

**`questions`** — el array de preguntas del tema (puede ser `[]` si aún no
tienes). Todas las preguntas de todos los temas forman un banco único filtrable:

```js
const questions = [
  { id: 1,
    apartado: 'Sistema solar',            // el sub-bloque de examen al que pertenece (antes `bloque`)
    articulo: 'sol',                      // (opcional) clave de sección → botón "Ver en el temario"
    pregunta: '¿Qué % de la masa concentra el Sol?',
    respuestas: ['50%', '75%', '99,8%', '90%'],  // el SDK las baraja al presentarlas
    correcta: '99,8%',
    explicacion: 'El Sol acumula el 99,8% de la masa total.' }
];
```

**`apartados`** — la lista de sub-bloques de **examen** del tema (las categorías
por las que se filtran las preguntas; el campo por pregunta es `q.apartado`). En
el setup del examen, cada tema se puede expandir en sus `apartados`. Un tema sin
preguntas en ninguno de sus `apartados` no aparece en el examen.

> Desde SDK v0.1.25 estos campos se llaman `apartados` (tema) y `apartado`
> (pregunta). Los antiguos `bloques`/`bloque` siguen funcionando (retrocompatible),
> pero en temas nuevos usa `apartados`/`apartado`.

---

## 11. Referencias cruzadas entre temas — `engine.external` *(opcional)*

Para enlazar a un artículo de **otro** tema:

```js
external: {
  prefix: 'T3-',                          // prefijo que marca la ref como externa
  map: { '105': 'Participación ciudadana…' },  // clave → descripción
  temaId: 'tema3',                        // tema destino
  label: 'Tema 3'                         // etiqueta mostrada
}
```

En el texto de una sección, `refs: [{ t: 'art. 105.b CE', r: 'T3-105.b' }]` crea un
botón que abre un panel con el contenido del tema destino y un enlace
`#/tema/tema3/<ancla>`.

---

## 12. Build y despliegue

El `package.json` de la app declara la dependencia del SDK **fijada a un tag** y
en formato `git+https` (importante para el `npm ci` de un CI como Vercel; el
lockfile NO debe quedar en `git+ssh`):

```jsonc
"dependencies": {
  "apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#v0.1.20"
}
```

Scripts típicos: `dev` (vite), `build` (vite build → `dist/index.html`
autocontenido), y opcionalmente `release` (build + un `scripts/release.mjs` que
inyecta la clave IA en una copia LOCAL).

**Clave de la IA (Groq) — patrón de seguridad:** el cliente IA del SDK lleva un
**placeholder** `__GROQ_KEY__`, que se bundlea en el `dist/index.html`. En
producción (servido por http) la app usa un proxy same-origin `/api/groq` que
guarda la clave en el servidor, así que **el build desplegado va SIN clave**. Solo
la copia **local/offline** sustituye el placeholder por la clave real (con el
`release.mjs` de la app). Verifica siempre que el build desplegado no contenga la
clave (`grep gsk_ dist/index.html` → 0).

---

## 13. Propagar un cambio del SDK a la app

Al subir una versión nueva del SDK (`git tag vX.Y.Z`), en cada app:

```bash
npm install "apuntes-sdk@git+https://github.com/luishidalgoa/apuntes-sdk.git#vX.Y.Z"
# asegúrate de que package.json y el lockfile quedan en git+https (no git+ssh)
npm run build   # + redeploy
```

---

## Referencia rápida de la API

`createApp(appConfig, temas)` — arranque.

**Render de manifiestos:** `renderCardTreesInto`, `renderSectionsInto`,
`renderArticleBlock`, `renderCard`, `renderArtRow`, `linkify`, `specialTagChip`,
`renderInfographic` / `renderInfographicInto` (+ `INFO_ICONS`).

**Utilidades:** `esc`, `config`, `anchorId`, `revealAnchor`, `CRAYON_FILTERS`.

**Marcar / subrayar / copia:** `bindMarks`, `markButton`, `toggleMark`… ·
`bindHighlighting`, `applyHighlightsInto`… · `exportBackup`, `importBackup`.

**Buscador:** `openSearch`, `searchContent`, `buildIndex`, `warmIndex`,
`invalidateIndex`, `mountSearch`.

Estilos: `import 'apuntes-sdk/styles'`.
