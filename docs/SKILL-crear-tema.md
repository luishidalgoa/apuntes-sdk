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

### 9.1 Qué hace que una tarjeta enseñe

Estas siete salieron de rediseñar temas con el usuario delante, y están ordenadas
por lo que más cambió el resultado. Valen para cualquier materia: la primera se
escribió sobre tipos abstractos de datos y se aplica igual a un articulado.

**1 · Busca la regla que sustituye a memorizar la lista — y que sea el criterio
real.** «Cada TAD se define por la operación que tiene que ser rápida, y esa
exigencia elige la estructura» sustituye a ocho pares que había que memorizar:
ahora se deducen. Y «¿cómo llegas al siguiente elemento?» sustituye a las
etiquetas *lineal / no lineal / tabular*, con la ventaja de que **se puede
aplicar a un caso que el alumno no haya visto nunca**. Una regla inventada para
que rime no sirve: tiene que ser aquello por lo que las cosas de verdad se
distinguen.

**2 · Una tabla que empareja dos abstracciones no enseña nada.** «Set → árbol
rojo-negro · tabla hash» va de algo que no se ve a algo que tampoco. Cada fila
necesita **un ejemplo con datos dentro**. Y ojo con lo que cuenta como ejemplo:
una frase del tipo «como la agenda del móvil» **no lo es** — el lector pide *ver
la cosa con datos*, no que le digan dónde la ha visto antes. Es la corrección
que más enderezó este trabajo, y llegó sobre una versión que ya tenía «ejemplos»
en prosa.

**3 · Interactivo cuando la idea es un proceso.** El hash no se entiende leyendo
que «se calcula la posición»: se entiende pulsando tres claves y viendo que cada
una enciende otra cubeta. Para decidir cuándo merece la pena, §10.1 tiene el
criterio y `mountStepper` la herramienta.

**4 · Contraste y contraejemplo, mejor que ejemplos que cumplen todo.** Pila y
cola juntas dejan de confundirse; árbol y grafo se explican por oposición. Y la
regla dura: **si la tarjeta afirma «ni A implica B ni B implica A», hacen falta
DOS contraejemplos, uno por dirección.** Un ejemplo que cumpla las dos
propiedades no demuestra nada y encima sugiere lo contrario del texto — pasó de
verdad con «lleno» y «completo», y el dibujo estuvo **un mes en producción**
contradiciendo a su propia tarjeta sin que nadie lo notara.

**5 · Un `truco` da una prueba aplicable, no un recordatorio.** Bueno: «para
descartar que sea estricto basta encontrar un nodo con un único hijo». Malo:
«recuerda que perfecto es el más exigente».

**6 · Modelo real antes que metáfora.** Ctrl+Z no es *como* una pila: **es** una
pila. Una analogía es un andamio —útil para subir, y se cae cuando llegan los
casos raros—; el modelo real aguanta todas las piezas del tema. Si la metáfora
es lo que la cosa modela de verdad (Active Directory y un grupo de empresas), no
estás comparando: estás nombrando.

**7 · Decide qué se queda fuera, y dilo.** Dos tarjetas vecinas no pueden
dibujar lo mismo: si una dibuja estructuras concretas con datos, la otra dibuja
formas genéricas. Si las dos hacen lo mismo, la pregunta «¿para qué están las
dos?» no tiene respuesta y sobra una.

#### El flujo, que importa tanto como las reglas

- **Enseña el rediseño embebido y espera el visto bueno antes de aplicarlo.**
  Evita trabajo tirado, y el que revisa ve el resultado, no una descripción.
- Cuando pregunten «¿hay más cosas útiles que cambiar?», responde con una
  **auditoría ordenada por impacto y una recomendación**, no con una lista plana.
- Dos comprobaciones que han encontrado agujeros reales cada vez que se han
  hecho: **¿el repaso final cubre todos los apartados?** (dos temas lo tenían a
  medias) y **¿el `desc` nombra lo que luego se pregunta?** — si no, es un hueco
  de contenido disfrazado de problema de diseño.

#### Busca las asimetrías, no solo los huecos

Al revisar un tema ya escrito, el defecto fácil de ver es «falta contenido». El
que se escapa es **el mismo tipo de contenido recibiendo tratos distintos**:
enterrado en un pie de letra pequeña aquí, con tarjeta propia allá. Nadie lo
reporta como fallo —está todo— pero al estudiar solo se encuentra la mitad.

El síntoma se caza comparando el temario original consigo mismo: **si la fuente
dedica un punto a lo mismo en tres bloques, tu tema debería darles el mismo
rango**. Pasó de verdad: los comandos de procesos tenían tarjeta, los de memoria
vivían en un pie al final de un desplegable —invisibles si no lo abrías— y los de
módulos no existían. Ninguna revisión de «¿falta algo?» lo habría encontrado.

Y al desenterrar, añade a cada dato **el matiz que lo hace útil en vez de
memorizable**: no «`free -h` muestra la memoria», sino que la columna que importa
es *available* y no *free*. Es la diferencia entre una lista que se olvida y algo
que se entiende una vez.

### 9.2 Reglas visuales

- **Colores**: solo variables de la paleta (`var(--t1)`, `var(--tema-accent)`).
  **Nunca** un hex a pelo en el contenido — rompe el modo oscuro y la coherencia.
- **Clases de color por sección** (`b-estructura`, `c1`): defínelas en el
  `palette.css` de la app, no con estilos en línea.
- **Jerarquía tipográfica**: la da el SDK. Usa `<h2>` en bandas/apartados y deja
  que el CSS mande; no fijes tamaños.
- `reveal` en bandas y tarjetas activa la animación de entrada.

#### El `viewBox` de un SVG cambia el tamaño que declaras, en los dos ejes

Dentro de un SVG **nada de lo que escribes está en píxeles**: está en unidades de
`viewBox`, y el navegador las multiplica por `ancho_real / ancho_del_viewBox`. Un
diagrama de `viewBox="0 0 520 …"` metido en los 286 px que deja una tarjeta en
móvil se dibuja a escala **0,55**: un `font-size:12` se ve a **6,6 px**. Pasó, y el
texto afectado era el que llevaba la lección, no la decoración.

El número declarado **solo coincide con el real cuando la escala es 1**, y eso
suele pasar únicamente en el ancho grande. Al dar por buena una medida, di
siempre **el par y el ancho**: «declarado 13, real 11,6 a 375 px».

Y tiene un gemelo horizontal que es peor: **el ancho del texto también vive en
unidades de `viewBox`**. Una frase que ocupa 370 unidades en un lienzo de 320 se
sale por los dos lados y **desaparece sin dejar rastro** — no hay `overflow` que
lo delate, ni consola que se queje, ni nada que se vea raro. Comprueba que
`getBBox().x + width` cabe en el ancho del `viewBox`, y si es prosa, sácala del
SVG al `figcaption`: el SVG es para lo que tiene coordenadas.

Dos salidas cuando un diagrama no cabe: subir el `font-size` en unidades de
`viewBox` (rápido, pero desajusta la tarjeta si esa clase es compartida) o partir
la figura en varios SVG más pequeños (cambia la escala de verdad). La segunda
suele ser la buena cuando hay dos cosas que comparar.

#### Reserva la altura **por bloque**, no en el contenedor

Si al pulsar cambia un texto, reserva su altura o la página pega un salto. Pero
un solo `min-height` en el contenedor **solo estabiliza el borde exterior**: por
dentro los bloques siguen deslizándose unos contra otros, y el salto que ves al
comparar dos opciones sigue ahí. Reserva **cada bloque que varíe**; entonces el
contenedor no necesita reserva propia.

Dos formas de medir mal la reserva, las dos ocurridas:

- **Medir con la reserva puesta** — mides la reserva, no el contenido. Ponla a
  `0`, recorre todos los estados, y quédate con el máximo.
- **Medir antes de que asiente la fuente web** — con la tipografía de repuesto
  las alturas salen distintas. Espera a `document.fonts.ready`; sin eso salió un
  salto de 21 px que no existía.

Y comprueba que la reserva sigue haciendo algo: si el **mínimo** del contenido ya
la supera, esa línea no reserva nada. Es el tipo de código que se hereda como si
funcionara.

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
| **escena muda**: mando de ≥2 controles y ningún `[aria-live]` cerca | quien no ve la pantalla oye que pulsó un botón y nada más |
| **motor propio**: un temporizador que se repite en un módulo de tema | reimplementa el motor y suele dejar fuera la narración y la guarda |

### Una escena que cambia al pulsar tiene que decir qué cambió

Marcar el botón activo con `aria-pressed` dice **cuál está pulsado**; no dice
**qué pasó**. Falta la otra mitad: una región viva en el bloque que se reescribe.

```html
<div class="cnc-info" role="status" aria-live="polite">…</div>   <!-- se sustituye -->
<div class="cli-out"  role="log"    aria-live="polite"></div>    <!-- se le añaden líneas -->
```

`status` para un valor que se reemplaza, `log` para uno al que se van añadiendo
líneas. Ponla en el bloque **entero** que responde a lo que acabas de pulsar: si
la respuesta son tres piezas (el valor, qué mide y por qué), anunciar solo la
definición lee la explicación sin decir el resultado.

Si la escena tiene **pasos**, no la montes a mano: `mountStepper` ya trae los
controles, el contador, la guarda del temporizador y el `aria-live` — y lo único
que se olvida al hacerlo a mano es justo lo que no se ve probando con el ratón.

**Son dos defectos distintos, no uno.** Darle voz a un reproductor casero cierra
su mudez, pero **no** arregla que su temporizador siga corriendo si la vista se
re-renderiza. Por eso `motor-propio` avisa aunque la escena ya narre, y por eso
no indulta a un módulo por mencionar `mountStepper`: uno puede montar una escena
con el motor del SDK y llevar otra a mano en el mismo fichero.

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

#### Probar lógica interactiva sin navegador (linkedom)

**`linkedom` no es solo para validar HTML: sirve para probar lógica interactiva.**
Monta el módulo sobre un DOM de linkedom y ejecuta **sesiones completas** —varios
comandos o pasos seguidos— comprobando el estado **después de cada paso**, no solo
el render inicial. Es la respuesta cuando no puedes usar el navegador.

Encuentra lo que leer el código no enseña. En un simulador de terminal destapó
dos defectos invisibles en la fuente: columnas desalineadas (`slice` en vez de
`padEnd`) y decimales con punto donde el locale usa coma — justo en una salida
cuya lección era saber leerla.

##### Puede fabricar un fallo que no existe (y esto es lo peligroso)

**El falso negativo te frena; el falso positivo te hace romper cosas.** El
primero cuesta tiempo, el segundo cuesta **código correcto**: te lleva a
«arreglar» algo que funcionaba.

Ocurrió con un sandbox gobernado por dos `<select>`: la prueba daba «mismo
dominio» en **todos** los casos y parecía un fallo de la lógica. No lo era.
**linkedom no retiene `selected` en options creadas por `innerHTML`**, así que
`value` sale `undefined` — y `undefined === undefined` cuela por la primera rama.
Un valor ausente disfrazado de coincidencia.

> **La señal para reconocerlo en caliente: si TODOS los casos dan el mismo
> resultado, sospecha del arnés antes que del código.** Un fallo real suele ser
> selectivo —algunos casos bien, otros mal—; que la matriz entera colapse a una
> sola respuesta apunta a que la entrada nunca llegó. Es la hermana de «si el
> síntoma sale en todas las tarjetas, es el entorno».

**La salida no es rodearlo, es quitar la dependencia.** Cuando la lógica viva
detrás de controles de formulario, **sácala a una función pura y prueba esa** —
el DOM simulado miente más cuanto más te acercas a los `<select>`. Extraer
`veredicto(origen, destino, confianza)` permitió verificar la matriz 4×4 entera
sin tocar el DOM, y de paso dejó la regla de negocio aislada y testeable.

##### El comprobador se equivoca de dos formas distintas

Arriba está la primera: el arnés que **fabrica errores inexistentes**. El gemelo
es el que **da un resultado incorrecto sobre datos correctos, por una suposición
implícita suya**. Al verificar los recorridos de un árbol dibujado en SVG, un
comprobador dio el inorden por erróneo porque asumía que **un hijo único es el
izquierdo**. No lo es: en un SVG **la lateralidad está en la geometría, no en el
orden de los elementos** — un hijo es izquierdo o derecho según su `x` respecto
al padre. La tarjeta estaba bien; el comprobador no.

> **Señal de alarma: si la comprobación contradice a un contenido que lleva
> tiempo publicado, sospecha del comprobador antes que del contenido.** El
> contenido lo ha leído alguien; el comprobador lo acabas de escribir. Y al
> revés: que confirme lo que esperabas no lo valida.

**Corolario práctico: una comprobación solo vale para lo que mide.** Reconstruir
padres, hijos y alturas desde un SVG no necesita lateralidad y sale bien; en
cuanto entra el inorden, esa misma reconstrucción es insuficiente **sin que nada
cambie en el código**. Antes de reutilizar un comprobador, comprueba que lo que
ahora mides cabe en lo que él sabe distinguir.

> **Pero el corolario importa tanto como la técnica: linkedom prueba que la
> lógica hace lo que crees; no prueba que lo que creías fuera lo correcto.**
> Quien escribe las pruebas recorre los caminos que diseñó. En ese mismo
> simulador todas las sesiones pasaban, y aun así `mount /dev/sdb1 /mnt/datos`
> —una ruta plausible que al autor no se le ocurrió— respondía «orden no
> encontrada», culpando al comando cuando el fallo era del argumento. En una
> herramienta para aprender, **un error que señala mal enseña algo falso**.
>
> Por eso: cuando termines tus sesiones, prueba **entradas que no diseñaste**
> —argumentos raros, mayúsculas, espacios de más, campos vacíos, HTML en el
> input— y pide a alguien que no lo escribió que teclee. Ahí es donde sale.

##### Medir el estado por defecto no es medir la escena

Una escena interactiva tiene tantos dibujos como estados, y el que ves al abrir
la tarjeta suele ser **el más pequeño**. En una escena de árbol de búsqueda, el
nodo que se inserta cuelga un nivel **por debajo** del más profundo — y solo
aparece al pulsar «Inserta». Dimensionar el lienzo con lo que había en pantalla
dejó ese nodo fuera, sin que ningún estado visible lo delatara.

Los dos carriles medimos la misma escena incompleta el mismo día, por caminos
distintos: uno al dimensionar, el otro al auditar. **El margen sobrante era de 46
unidades en los tres estados de búsqueda y de 6 en el de inserción**, así que el
único estado que decidía el alto era el que no se veía sin pulsar.

> **Y la trampa peor: los estados no son independientes.** Un barrido que pulsa
> los botones en orden cambia el modo por el camino, así que a partir de ahí mide
> las acciones siguientes **sobre el modo equivocado**. Pasó al verificar esto:
> ocho estados salieron correctos y ninguno era el que importaba, porque el
> «Inserta» se midió sobre el árbol degenerado, que no dibuja el nodo nuevo.
> Un barrido en secuencia **no visita lo que cree visitar**.
>
> Recorre el **producto** de las dimensiones (modo × acción), reponiendo el modo
> antes de cada acción, y comprueba los límites en **todos** los estados — no en
> el primero ni en el último.

##### La media query que copias puede quedar muerta

`@media` **no añade especificidad**: entre dos reglas de un mismo selector decide
el **orden**. Una media query colocada *antes* de la regla base no anula nada.

Pasa al reutilizar: se añade un selector a una media query que ya existe y
funciona, sin mirar dónde está la base del selector nuevo. Ocurrió con dos
selectores **en la misma línea** — uno con su base 5 líneas antes (vivo) y otro
con la suya 16 líneas después (muerto). El síntoma es de los malos: la línea está
escrita, se lee bien, y no hace nada.

Compruébalo en el navegador con `getComputedStyle`, no leyendo el CSS.

#### Varias instancias del mismo widget: comprobar que no se contaminan

Cuando la misma página monta **varias instancias de un widget con estado**
(varios simuladores, varios steppers, varias tablas filtrables), verificar que
cada una *funciona* **no basta**: hay que verificar que son **independientes**.
«Cada uno funciona» no implica «cada uno es suyo», y con estado interno menos.

**Cómo se prueba:** opera en una instancia y comprueba que **las demás no han
cambiado**. Ejecuta en la primera, vuelve a la segunda y compara su salida con la
que daba antes — debe ser **idéntica**. Buscas una diferencia que no debería
existir, así que la comparación tiene que ser exacta, no «parece igual».

**Los tres modos de fallo que lo provocan**, los tres visibles leyendo el código
una vez que sabes qué buscar:

| Síntoma | Causa |
|---|---|
| Operar en una cambia **todas** | El estado está en el **ámbito del módulo** (`const st = {...}` fuera de la factoría) en vez de crearse por instancia |
| Actúa siempre sobre la **primera** | Selectores desde `document` (`document.querySelector('.out')`) en vez de desde el **host** (`host.querySelector`) |
| Un clic dispara **varias** | Listener delegado en `document` sin acotar al contenedor de la instancia |

**Por qué se escapa:** montar N instancias y verlas pintadas da sensación de
haberlo probado. El fallo no está en el render — está en la **primera
interacción**, que es justo lo que no se mira cuando solo compruebas que
aparecen.

Y **esta comprobación no necesita navegador**: monta el HTML real con varias
instancias sobre linkedom, opera en una y compara el `textContent` de la otra.
No es de las que hay que delegar.

#### Comprueba el conjunto, no el caso que te señalan

Cuando te reportan un dato malo, **lista ese mismo campo en todos los ficheros
hermanos antes de darlo por cerrado**: si llegó ahí por copia, estará en más
sitios. Y al revés, **poner los registros en fila —un índice, una tabla, un
listado— hace que un valor repetido cante**; de uno en uno no se ve.

> **Un dato inventado que se replica es peor que el original: cuantas más veces
> aparece, más parece verificado.**

Pasó con el tiempo de un examen. Se puso `minutos: 110` por asunción, sin
verificarlo, y al montar el examen siguiente se copió la cabecera entera. Cuando
se reportó el primero, arreglar solo ese habría dejado el otro — y el segundo
respaldaba al primero por el mero hecho de coincidir. Se cazó por las dos vías a
la vez: listando el campo en los tres ficheros, y viendo las tres fichas en fila
en un índice recién hecho. Las dos mitades de la misma idea.

Y el fondo es el mismo que el de `correcta: null`: **el modelo tiene que poder
decir «no lo sé»**. Un tiempo inventado no es un dato cosmético — entrena un
ritmo que no es el del examen, y quien lo usa no tiene forma de saberlo porque
el número parece oficial. Mejor un hueco declarado que un valor verosímil.

> **Pero poner los datos en fila no basta si eliges el eje de antemano.** La
> tabla enseña lo que la agrupación deja ver, así que agrupar por la hipótesis
> que ya tienes la confirma sola. Pasó justo después de escribir esta regla:
> cuatro exámenes tabulados, agrupados por «plantilla definitiva vs provisional»
> para explicar cuántas preguntas anulaba cada uno — y el contraejemplo estaba
> **en la propia tabla**, en una fila que no encajaba. El eje que separaba los
> datos era otro (el tipo de convocatoria, con 80 preguntas frente a 50).
>
> Antes de dar por buena una lectura: **busca la fila que no encaja y prueba a
> agrupar por otra columna**. Y con pocos casos, dilo — dos de cada lado son una
> sospecha, no un patrón.

Si alguna falla, es casi seguro un incumplimiento del contrato (§3) — repasa §11.

---

## 13. Plantilla mínima para empezar

Copia [`examples/starter/src/temas/tema1/index.js`](../examples/starter/src/temas/tema1/index.js)
y sustituye el contenido. Es un tema completo y válido: úsalo como esqueleto en
vez de partir de cero.
