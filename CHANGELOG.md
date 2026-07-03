# Changelog — apuntes-sdk

Una entrada por versión (tag `vX.Y.Z`). Al arrancar una sesión de trabajo,
revisa aquí qué cambió respecto a la versión que consume tu app.

Cómo consume una app una versión (en su `package.json`):
`"apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#vX.Y.Z"`
(el lockfile debe quedar en `git+https`, no `git+ssh`, para el `npm ci` de Vercel).

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
