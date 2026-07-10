# Changelog — apuntes-sdk

Una entrada por versión (tag `vX.Y.Z`). Al arrancar una sesión de trabajo,
revisa aquí qué cambió respecto a la versión que consume tu app.

Cómo consume una app una versión (en su `package.json`):
`"apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#vX.Y.Z"`
(el lockfile debe quedar en `git+https`, no `git+ssh`, para el `npm ci` de Vercel).

## v0.1.24
- **Nuevo (UI)**: tarjetas de **materia y examen "vivas"** (inspiración
  Aceternity UI), sustituyendo el numeral/emoji genérico:
  - **Tilt 3D** (3D Card Effect): la tarjeta rota siguiendo el ratón
    (perspective + rotateX/rotateY) y sus capas internas (`[data-depth]`) se
    **elevan** con translateZ al hover; la vuelta al reposo lleva un muelle.
  - **Iconos a medida** por materia: escenas SVG dibujadas ex profeso sobre una
    losa con gradiente del acento, **animadas con Motion** (la API vanilla de la
    casa de Framer Motion, nueva dependencia `motion`): la **balanza** (`law`)
    oscila, el **chip** (`chip`) late y sus pistas fluyen, y los **checks** del
    examen (`exam`) se dibujan en secuencia. La app elige el icono con
    `materias[].icon` (fallback: el `numeral` de siempre).
  - **Badge en abanico** (Images Badge): los numerales de los temas de la
    materia, solapados, se despliegan al hover.
  - Respeta `prefers-reduced-motion`. Módulo `core/materia-cards.js`
    (`bindMateriaCards`, catálogo `MATERIA_ICONS` ampliable); CSS en
    `styles/hub.css`; cableado en el hub y en el hub de materia.

## v0.1.23
- **Nuevo (animaciones)**: la navegación y el scroll cobran vida, de forma
  genérica (todas las apps lo heredan; el router lo cablea solo).
  - **Transición de entrada** al cambiar de vista: el contenido aparece con un
    breve fundido + desplazamiento (`#view.view-in`), en vez de un salto brusco.
  - **Scroll-reveal**: las tarjetas, bandas y bloques (`.tema-card/.card/.node/
    .band/.art-block`) suben y aparecen al **entrar** en el viewport y se atenúan
    al **salir** (IntersectionObserver, bidireccional), con un **fallback de
    scroll** que revela lo que va entrando aunque el observador no dispare (así
    el contenido nunca queda invisible). Revelación inicial **síncrona** (antes
    del primer paint) → sin parpadeo.
  - Respeta **`prefers-reduced-motion`** (sin animación si el usuario lo pide).
  - Módulo `core/scroll-reveal.js` (API `bindScrollReveal`/`unbindScrollReveal`);
    CSS en `styles/base.css`; cableado en `router.js`.

## v0.1.22
- **Nuevo (navegación)**: capa **«materia»**, una puerta de navegación de primer
  nivel por encima del tema (p. ej. «Legislación» y «TAI técnica» en una misma
  app). Contrato: `appConfig.materias = [{ id, label, descripcion?, accent?,
  numeral? }]` y cada tema declara `materia:'<id>'`. **Opcional y retrocompatible**:
  si no hay materias, la portada es directamente la lista de temas (una sola
  materia), como hasta ahora.
  - **Portada** (`#/`): selector con una **tarjeta por materia**; al entrar,
    **hub de la materia** (`#/materia/<id>`) con sus temas.
  - La **barra del tema** vuelve al hub de su materia («← Materia») y el
    desplegable de Temas se acota a los temas de esa materia.
  - **Buscador**: las migas incluyen la materia («Legislación › Tema 2 › …») y el
    nombre de la materia es buscable.
  - **Examen**: el setup agrupa los temas por **materia** (cabecera + checkbox que
    marca/desmarca sus temas); si no hay materias, cae a la agrupación por bloque.
  - La agrupación por `bloque` sigue actuando **DENTRO** de cada materia (materia
    NO reemplaza a bloque). Helpers nuevos en el registry: `hasMaterias`,
    `materiaOf`, `temasOfMateria`, `materiasWithTemas`. Cambios en `config.js`,
    `registry.js`, `router.js`, `index.js`, `core/content-index.js`,
    `views/{temario,tema,examen}.js`, `styles/hub.css`.

## v0.1.21
- **Nuevo**: el **buscador entiende lenguaje natural + IA** (mini-RAG genérico).
  Al escribir una pregunta, en vez de solo casar palabras, el buscador:
  1. Detecta que es una pregunta y extrae sus **términos clave** (fuera palabras
     vacías/de pregunta; conserva acrónimos como AVL/ABB) — algorítmico, sin
     depender de la gramática.
  2. **Recupera** los puntos del temario relevantes con el propio índice del
     buscador (los detecta porque están indexados).
  3. Se los pasa a la **IA** (misma `/api/groq` del tutor del examen) como
     contexto para que **responda conciso y cite el/los punto(s)** → botones
     «Ir a la explicación» (deep-link al punto exacto).
  - Sin clave IA, los pasos 1-2 (detectar + recuperar + saltar) funcionan igual;
    solo el botón «Responder con IA» queda deshabilitado con aviso.
  - `core/ai.js` (nuevo): cliente Groq compartido `callGroq`, extraído de
    `exam/ai.js` (que ahora lo importa). `core/search-ask.js` (nuevo):
    `isQuestion`, `keyTerms`, `retrieve`, `askTemario`. `search-ui.js`: barra
    «✨ Responder con IA». `config.js`: `searchAiSystemPrompt` (opcional).
    `styles/search.css`. 100% agnóstico, lo heredan todas las apps del núcleo.

## v0.1.20
- **Nuevo (estructura)**: capa opcional **«bloque»** por encima del tema, para
  agrupar temas (p. ej. «Bloque 1», «Bloque 2»…). Contrato agnóstico: un tema
  declara `bloque` (una etiqueta `'Bloque 1'` o `{ id, label }`) y el SDK agrupa
  y etiqueta por él, **sin hardcodear nada**; si ningún tema trae `bloque`, no hay
  agrupación (100% retrocompatible). Aparece en las **cuatro superficies**:
  - **Hub**: los temas se agrupan bajo cabeceras de bloque.
  - **Buscador**: las migas incluyen el bloque («Bloque 1 › Tema 4 › …») y el
    nombre del bloque es **buscable** (encuentra los temas de ese bloque).
  - **Examen**: cabecera de bloque con **checkbox** que marca/desmarca todos sus
    temas (con estado indeterminado), por encima de la agrupación por tema.
  - **Desplegable de Temas**: los temas se listan bajo su bloque.
  - Helpers nuevos en el registry: `bloqueOf(tema)`, `hasBloques()`,
    `groupedTemas()`. Cambios en `registry.js`, `core/content-index.js`,
    `views/{temario,tema,examen}.js` y `styles/{hub,exam,shared}.css`.

## v0.1.19
- **Fix (móvil)**: el **marcapáginas de tela** (la cinta vertical) tapaba el
  texto en el móvil, donde el contenido va a todo el ancho (la cinta de 56px
  caía sobre la columna de lectura). Ahora en ≤560px la cinta se **estrecha a
  22px y se pega al canto derecho** (`right:-4px`), quedando en el margen sin
  solaparse con el texto de las tarjetas. Se hace con `preserveAspectRatio=none`
  en el SVG: la cinta solo se **comprime en horizontal**, conserva su altura
  (baja hasta la tarjeta marcada) y **la animación verlet de caída/ondulación
  sigue intacta**. Además se desvanece al abrir un panel lateral. El clic sigue
  saltando al marcador. En tablet/escritorio, sin cambios (56px). Solo
  `core/bookmark.js` (atributo del SVG) + `styles/shared.css`.

## v0.1.18
- **Fix (móvil)**: el desplegable de **Opciones** dejaba ver los chips de «En
  esta página» por encima. Causa: en ≤560px `.controls` pasaba a
  `position:static`, que destruía su contexto de apilamiento (z-index:30) y el
  popup (z-index:40, dentro) dejaba de dominar a los chips (que quedan detrás en
  el DOM). Ahora `.controls` usa `position:relative` en móvil (sigue sin ser
  sticky, pero conserva el contexto), así el popup los tapa.
- **Fix (móvil)**: el **modo tablet** ya no se activa en teléfonos. El modo
  agranda tipografías/layout (pensado para tablets); en un teléfono la
  preferencia guardada (`ce-tablet-mode=1`) lo dejaba oversized. Ahora
  `applyTabletMode`/`bindTabletButton` sólo aplican la clase `tablet-mode` si el
  ancho es >600px (reevaluado al redimensionar/rotar), y el botón «Modo tablet»
  se oculta/deshabilita en teléfono. La preferencia se conserva para cuando se
  abra en una tablet o escritorio.

## v0.1.17
- **Mejora (móvil)**: ergonomía táctil en pantallas ≤560px. Los objetivos de
  pulsación pequeños suben a un tamaño cómodo (≈44px): botones de icono de la
  barra (🔖🖍️🔍), la estrella de «marcar importante» (`.mark-btn`, SVG 17→20px +
  padding), los `.btn` en general (min-height 42px) y los chips de salto de
  sección (`.chip`, más padding). Padding lateral del `.wrap` a 16px en móvil
  para ganar ancho. Solo CSS en `styles/shared.css` (media query existente);
  cero cambios de markup, lo heredan todas las apps.

## v0.1.16
- **Mejora (UI)**: el **desplegable de Temas** muestra cada tema como
  «Tema N — Título» y, debajo, sus **bloques/secciones** (las labels de sus
  `chips`) separados por «·» y con **ellipsis** si no caben. Antes solo se veía
  el título («Estructura de datos») aunque el tema tuviera varios bloques.
  Cambio en `views/tema.js` (genérico: usa los chips del manifiesto; si un tema
  no tiene chips, cae a su `descripcion`).

## v0.1.15
- **Cambio (UI)**: el acceso al buscador en la **barra del tema** pasa de un
  icono 🔍 suelto a una **barra de búsqueda** (caja tipo input con lupa,
  «Buscar en el temario…» y atajo `⌘K`), **centrada** entre los dos grupos de
  navegación (izquierda: Temario/Temas · derecha: Examen/marcar/subrayar/
  Opciones), que reparten peso a partes iguales. Sigue abriendo el mismo overlay.
  En pantallas estrechas la barra baja a una **fila propia** a lo ancho. Coherente
  con la barra de búsqueda del hub. Cambios en `views/tema.js` y `styles/search.css`.

## v0.1.14
- **Fix (rendimiento)**: el **precalentado del índice** del buscador ya no
  bloquea el hilo principal al arrancar. Antes se construía el índice entero de
  golpe en un único hueco de inactividad (renderizaba los N temas seguidos), lo
  que en apps con temas de contenido pesado (p. ej. Legislación) podía congelar
  la UI varios segundos. Ahora es **incremental**: `warmIndex()` indexa **un
  tema por hueco de inactividad**, cediendo el hilo entre temas, así que ningún
  bloqueo supera el coste de renderizar un solo tema.
  - `buildIndex()` se conserva como camino **síncrono de respaldo** (si el
    usuario busca antes de terminar el precalentado, se completa de una vez); en
    cuanto está el índice, `warmIndex` se detiene. Nueva API: `warmIndex`.
  - El overlay (`search-ui.js`) llama a `warmIndex` en vez de `buildIndex`.

## v0.1.13
- **Nuevo**: **buscador global** genérico (🔍 en la barra del tema y en el hub,
  atajo `⌘/Ctrl+K` y `/`). Aprovecha la **estructura de contenido común** del
  SDK (bandas `.band`, tarjetas `.node/.card` con `.name`/`.desc`) que producen
  todas las apps: renderiza cada tema en un contenedor **desmontado** (sin cargar
  imágenes ni forzar layout) y saca un índice de "puntos" buscables con su tema,
  número de esquema y ancla para deep-link. 100% agnóstico de la asignatura, así
  que Legislación (u otras) lo heredan sin tocar contenido.
  - Búsqueda por **concepto** (título y cuerpo), por **número de punto** (5.9,
    4.3…) y con **tolerancia a erratas** (Jaro-Winkler: «djistrak»→Dijkstra).
  - Overlay tipo paleta de comandos: resultados rankeados con Tema · nº · título
    · migaja · fragmento; teclado ↑↓/↵/Esc; clic o ↵ salta al punto
    (`#/tema/<id>/<ancla>`, abre el desplegable si el ancla está dentro).
  - El índice se **precalienta** en inactividad tras cargar la app → 1ª búsqueda
    instantánea. API: `openSearch`, `searchContent`, `buildIndex`, `invalidateIndex`.
- **Módulos**: `core/content-index.js` (índice+scorer), `core/search-ui.js`
  (overlay), `styles/search.css`. Montado en `createApp` (`mountSearch`).

## v0.1.12
- **Fix**: la paleta de subrayado no se cerraba con ✕ / 🖍️ / Esc. Sí se llamaba
  a desactivar (ponía el atributo `hidden`), pero `.hl-palette{display:flex}`
  pisaba el `display:none` del atributo. Añadido `.hl-palette[hidden]{display:none}`.

## v0.1.11
- **Nuevo**: herramienta de **subrayado** de texto (🖍️ en la barra del tema).
  Paleta flotante ("chuleta") con colores y su **significado configurable**;
  selección **orgánica** (el texto se tiñe del color activo al arrastrar,
  reemplaza el azul del navegador); **goma** de borrar (arrastrar o clic sobre un
  subrayado lo quita); recolorear con un clic; ✕/🖍️/Esc para desactivar.
  Persiste por tema (`tai-highlights`), anclando al `id`/`data-mark-id` más
  cercano + offsets de carácter (con fallback al contenedor del tema), y se
  reaplica tras cada render. API: `bindHighlighting`, `applyHighlightsInto`,
  `toggleHighlight`, `registerHighlightButton`, `getHighlightColors`/`set…`.
  CSS `highlight.css`.
- **Nuevo**: **copia de seguridad** de anotaciones (Opciones → Exportar /
  Importar copia). Vuelca TODAS las claves de localStorage a un JSON que el
  usuario guarda y restaura en cualquier navegador/dispositivo (sin backend);
  red de seguridad frente a la fragilidad de localStorage. API: `exportBackup`,
  `importBackup`, `buildBackup`, `applyBackup`.

## v0.1.10
- **Nuevo**: el **examen se elige por TEMA**, no por bloque suelto. El setup
  agrupa los bloques bajo cada tema (checkbox de tema que marca/desmarca todos
  sus bloques, con estado *indeterminado* si hay selección parcial) y cada tema
  es **expandible** para elegir bloques concretos. Además, al entrar al examen
  desde la página de un tema (`#/examen/<temaId>`) se **preselecciona solo ese
  tema** (los demás quedan sin marcar pero se pueden añadir). Router: `#/examen`
  admite `/<temaId>`; el enlace "Examen" de la barra del tema lo incluye. La
  etiqueta de tema usa su número real (de la `k`). Genérico (agrupa por los
  `bloques` de cada tema del registry).

## v0.1.9
- **Nuevo**: motor de **infografías de cierre** de título/sección, data-driven.
  `renderInfographic(spec)` / `renderInfographicInto(el, spec)` montan un recap
  visual (cabecera con ilustración SVG propia + bloques tipados: `attrs`,
  `icons`, `steps`, `flows`, `banner`) teñido por `--info-accent` (cae a
  `--tema-accent`). Catálogo de iconos de línea `INFO_ICONS` (ampliable con SVG
  en crudo por ítem) y separador de `flows` configurable (`card.sep`, por
  defecto `→`). CSS nuevo `styles/infographic.css`. En legislación se usa para
  una infografía por título al final de cada tema (Título I, Corona, Cortes,
  TC, Defensor, Gobierno y relaciones con las Cortes).

## v0.1.8
- **Nuevo**: "marcar como importante" bloques de contenido. Una estrella ★ en
  cada tarjeta (`.card`), bloque de sección (`.art-block`) y banda/título
  (`.band[id]`); al marcar, el bloque se resalta con el acento y el estado se
  guarda por tema (localStorage `tai-marks`), reaplicándose al re-renderizar.
  Genérico: en legislación son artículos, secciones o títulos. API:
  `bindMarks(root, temaId)`, `markButton`, `isMarked`, `toggleMark`, `markedIds`.

## v0.1.7
- **Fix**: el desplegable de temas del navbar numeraba por posición (`Tema 1`,
  `Tema 2`…) en vez del número real del tema. Ahora toma el número de la `k` del
  manifiesto (p.ej. `"Tema 2 · …"` → `Tema 2`) y cae a la posición solo si no lo
  encuentra. Retrocompatible: apps con temas 1..N correlativos no cambian.
  Necesario para asignaturas cuyos temas no empiezan en 1 (p.ej. TAI: temas 2 y 3).

## v0.1.6
- **Fix**: destello de cinta recta antes de la animación del marcapáginas. El
  `ResizeObserver` disparaba `reposition()` al colocar y (herencia del rebote)
  re-renderizaba la cinta recta, pisando el primer frame. Ahora `reposition`
  solo endereza en reposo (`!raf`), nunca durante la animación.

## v0.1.5
- Marcapáginas, estilo "yo-yo": la cinta arranca **enrollada en espiral
  (caracol)** arriba y se desenrolla cayendo de arriba abajo (~2,2 s), lento,
  hasta quedar recta (reemplaza el rebote vertical de v0.1.4). Etiqueta del
  panel: "Yo-yo".

## v0.1.4
- Marcapáginas "muelle" pasa a **rebote vertical** (resorte): la punta cae, se
  pasa de largo y rebota arriba/abajo, sin balanceo lateral. Salto acotado a
  ~220px. (Sustituido en v0.1.5.)

## v0.1.3
- Marcapáginas con **dos estilos de animación** seleccionables (ajuste
  persistido `tai-bookmark-anim`) + **panel lateral de ajustes** que se abre
  desde Opciones → "Marcapáginas…". API: `getBookmarkAnim`/`setBookmarkAnim`/
  `previewBookmarkAnim`, `openBookmarkSettings`.

## v0.1.2
- Marcapáginas "cuerda" **flexible**: contorno con curvas bézier (Catmull-Rom)
  desplazando cada vértice por la perpendicular + arranque con onda lateral →
  se dobla como tela, no como un palo. Amplitud acotada con la longitud.

## v0.1.1
- Marcapáginas: física de cuerda por **vértices (verlet)** en vez del muelle por
  transform. (Refinado en v0.1.2.)

## v0.1.0
- **Primera versión.** Núcleo extraído de la app de Legislación a un SDK
  agnóstico de asignatura: shell + router, motor de examen (con IA vía proxy),
  minijuegos, marcapáginas, paneles y sistema de diseño (tipografía, tarjetas,
  bandas, rail). API `createApp(appConfig, TEMAS)` + helpers de render. Contrato
  de tema neutral (`sections`/`source`/`labelFor`/`keySplit`/`specialTags`).
  Frontera limpia (0 legislación en el SDK); `examples/starter` como plantilla.
