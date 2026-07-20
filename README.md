# apuntes-sdk

**Convierte tus apuntes en una app de estudio interactiva.** Es el núcleo
reutilizable —agnóstico de asignatura— que aporta toda la maquinaria; tú solo
pones el contenido.

Lo que obtienes **gratis** a partir de tus temas:

- **Examen** que baraja las opciones, puntúa y **explica al fallar** (con tutor IA opcional).
- **Buscador** global a nivel de artículo, **plan de estudio** por prioridad, **marcapáginas** y **subrayado** persistentes.
- **Glosario** de siglas clicable, **tarjetas** con truco, **minijuegos** (clasificación + flashcards).
- **Simulaciones y diapositivas** paso a paso (motor `mountStepper`).
- Compila a un **único `index.html`** que funciona sin conexión (doble clic, o súbelo donde quieras).

---

## Requisitos

**Node.js 18 o superior** ([nodejs.org](https://nodejs.org)). Es lo único. No hace falta saber programar si usas una IA para el contenido.

---

## Instalación y primer arranque

Un solo comando, sin instalar nada global:

```bash
npx --package "github:luishidalgoa/apuntes-sdk#v0.2.2" apuntes-crear-app mi-temario --titulo "Mi asignatura"
cd mi-temario
npm install
npm run dev
```

Se abre en el navegador con **dos temas de ejemplo** (uno con simulador), examen,
minijuegos y glosario, para que veas cómo queda. Esos los sustituirás por lo tuyo.

---

## Uso: crear tus temas

### A) Con IA — recomendado

El SDK trae un **contrato de autoría** autosuficiente para que cualquier IA
monte un tema válido sin conocer el SDK. Tras instalar, está en:

```
node_modules/apuntes-sdk/docs/SKILL-crear-tema.md
```

Pásaselo a tu IA (Claude, ChatGPT, Cursor…) junto con tu PDF:

> «Aquí tienes el contrato de autoría (SKILL-crear-tema.md) y el PDF de mi tema.
> Crea un tema en `src/temas/` siguiéndolo y regístralo en `src/registry.js`.»

**¿Tu IA soporta MCP?** (Claude Desktop, Claude Code, Cursor…) Conéctala al
servidor del SDK y ni copias ficheros — la IA crea, verifica y compila sola:

```jsonc
{ "mcpServers": {
  "apuntes": { "command": "npx",
    "args": ["-y", "--package", "github:luishidalgoa/apuntes-sdk#v0.2.2", "apuntes-mcp"] }
} }
```

Luego, en el chat: *«monta el tema de este PDF»*. Verbos disponibles:
`leer_contrato` · `crear_app` · `listar_temas` · `verificar` · `compilar`.
`verificar` devuelve los defectos **estructurados** (la IA se corrige sola) y
`compilar` se niega si el contrato no se cumple.

### B) A mano

1. Copia `src/temas/tema1/` a `src/temas/mi-tema/`.
2. Cambia el contenido siguiendo el ejemplo y el contrato.
3. Añade una línea en `src/registry.js`.

---

## Verificar y publicar

```bash
npm run verify   # audita que tus temas cumplen el contrato (0 errores)
npm run build    # genera dist/index.html: un único archivo, portable y offline
```

`npm run verify` es tu red de seguridad: te dice **qué está mal y por qué
importa** (ids duplicados, tarjetas que no saldrán en el buscador, siglas sin
glosario, preguntas mal formadas, respuestas contaminadas al extraer de un PDF…).
Sale con código ≠ 0 si hay errores, así que vale también para CI.

Para publicar: sube el `dist/index.html` a cualquier hosting estático (Vercel,
Netlify, GitHub Pages) o compártelo tal cual — es autocontenido.

---

## Cómo funciona (en breve)

Una app son **tres cosas** tuyas —configuración, paleta y temas— y el SDK pone
todo lo demás. El hub, el examen, el buscador, el plan de estudio y los
deep-links **se generan solos** a partir de tus temas.

```js
// src/main.js
import 'apuntes-sdk/styles';   // sistema de diseño + fuentes
import './palette.css';        // los acentos de TU asignatura
import { createApp } from 'apuntes-sdk';
import { TEMAS } from './registry.js';

createApp({ title: 'Mi asignatura', eyebrow: '…', lede: '…' }, TEMAS);
```

Cada tema es una carpeta `src/temas/<id>/` con un manifiesto (**el contrato
completo está en `docs/SKILL-crear-tema.md`**):

```js
export default {
  id, titulo, k, descripcion,        // identidad (obligatorio)
  numeral, accent, headerHtml, chips,// presentación
  materia, bloque,                   // navegación (opcional)
  engine,                            // contenido citable (sections/source/…)
  renderContent(el){ … },            // pinta el cuerpo con los helpers del SDK
  questions, games, glossary         // examen, minijuegos, glosario (opcional)
};
```

> **La regla de oro**: el SDK no lee tus datos, lee el **DOM** que produces.
> Buscador, plan de estudio, marcador, glosario y deep-links funcionan todos
> reconociendo unas clases e `id` concretos. Si respetas ese contrato (lo
> documenta el skill), esas funciones aparecen solas; si te lo saltas, el tema
> se ve bien pero queda mudo. Por eso `npm run verify` lo audita por ti.

**Glosario por materia:** mantén un `src/temas/<materia>-glossary.js` compartido
e importa `glossary: MI_GLOSARIO` en cada tema. Va por materia (no global)
porque las claves colisionan entre asignaturas (`IT` = Incapacidad Temporal vs
Information Technology).

---

## Herramientas y componentes

| CLI (vienen con el paquete) | Qué hace |
|---|---|
| `apuntes-crear-app` | Crea una asignatura nueva desde la plantilla |
| `apuntes-verify` (`npm run verify`) | Audita el contrato de todos los temas |
| `apuntes-mcp` | Servidor MCP para pilotar todo desde un cliente de IA |

| Componente (`import … from 'apuntes-sdk'`) | Para |
|---|---|
| `mountStepper` | Simulaciones y diapositivas paso a paso (presets `player`/`deck`) |
| `renderInfographic` | Infografía de cierre (recap visual) |
| `renderCard`, `renderCardTreesInto`, `renderSectionsInto`, `renderArtRow` | Helpers de render de los manifiestos |
| `linkify`, `esc`, `config`, `anchorId`, `revealAnchor` | Utilidades |

---

## Para integradores (desarrollo)

`createApp(appConfig, temas)` inyecta la config, registra los temas, monta el
shell (una vez) y arranca el router hash. Estilos en `apuntes-sdk/styles`.

**Fijar la dependencia** en el `package.json` de una app (a un tag, en
`git+https` — el lockfile NO debe quedar en `git+ssh`, o el `npm ci` de Vercel
falla):

```jsonc
"dependencies": { "apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#v0.2.2" }
```

**Propagar una versión nueva del SDK** a una app existente:

```bash
npm install apuntes-sdk@github:luishidalgoa/apuntes-sdk#vX.Y.Z
npm run build   # + redeploy
```

Se compila **dentro del singlefile** de la app (Vite + `vite-plugin-singlefile`):
fuentes y CSS quedan inlinados y el HTML resultante funciona por `file://`.

---

## Documentación

- **[EMPEZAR-AQUI.md](EMPEZAR-AQUI.md)** — arranque para un usuario nuevo, sin programar.
- **[docs/SKILL-crear-tema.md](docs/SKILL-crear-tema.md)** — el contrato de autoría de UN tema (para pasarle a una IA).
- **[docs/crear-temario.md](docs/crear-temario.md)** — guía completa de montaje de la app.
