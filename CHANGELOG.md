# Changelog — apuntes-sdk

Una entrada por versión (tag `vX.Y.Z`). Al arrancar una sesión de trabajo,
revisa aquí qué cambió respecto a la versión que consume tu app.

Cómo consume una app una versión (en su `package.json`):
`"apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#vX.Y.Z"`
(el lockfile debe quedar en `git+https`, no `git+ssh`, para el `npm ci` de Vercel).

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
