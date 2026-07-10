# apuntes-sdk

Núcleo reutilizable para apps de **apuntes de estudio**: el shell (router hash,
navbar, opciones), el motor de **examen** (con tutor IA opcional vía proxy),
**minijuegos** (clasificación + flashcards), el **marcapáginas de tela**, los
**paneles** de referencia/texto fuente y el **sistema de diseño** (tipografía,
tarjetas, bandas y el rail que une sección con sección). Es **agnóstico de
asignatura**: cada app aporta su configuración, su paleta y su contenido.

Se consume como **dependencia** y se compila **dentro del singlefile** de cada
app (Vite + vite-plugin-singlefile), así que las fuentes y el CSS quedan
inlinados y la app funciona por `file://` sin red.

## Instalar en una app

```jsonc
// package.json de la app — fíjala a un tag y en formato git+https
// (el lockfile NO debe quedar en git+ssh, o el `npm ci` de Vercel falla)
"dependencies": { "apuntes-sdk": "git+https://github.com/luishidalgoa/apuntes-sdk.git#v0.1.20" }
```

```js
// src/main.js
import 'apuntes-sdk/styles';   // sistema de diseño + fuentes
import './palette.css';        // los acentos de TU asignatura
import { createApp } from 'apuntes-sdk';
import { TEMAS } from './registry.js';

createApp({
  title: 'Mi asignatura',
  eyebrow: 'Oposición X · Asignatura Y',
  lede: '…',
  aiSystemPrompt: 'Eres un tutor de …',
  anchorPrefix: 'sec-',        // 'art-' si quieres compatibilidad con deep-links viejos
  externalPrefixes: []         // p.ej. ['CE-'] para refs cruzadas entre temas
}, TEMAS);
```

## Crear una asignatura nueva

**Guía completa paso a paso: [`docs/crear-temario.md`](docs/crear-temario.md).**

En resumen: clona `examples/starter` (una asignatura mínima que NO es de
legislación) y sustituye el contenido. Cada tema es una carpeta
`src/temas/temaN/` con un manifiesto:

```js
export default {
  id, numeral, k, titulo, descripcion, accent, headerHtml, chips?, hintHtml?,
  bloque?,             // (OPCIONAL) capa que agrupa temas ('Bloque 1' o {id,label});
                       // si ningún tema la declara, no hay agrupación (retrocompatible)
  engine: {
    sections,          // { clave: { title, text | apartados:[{n,text,refs?,tags?}] } }
    source?,           // { clave: { title, paragraphs:[{n,text}] } }  (texto fuente)
    labelFor(key),     // clave → etiqueta ('Art. 97', 'El Sol', …)
    keySplit,          // 'first' | 'last' (por qué punto se parte la clave)
    sourceDigitFallback?, specialTags?, external?
  },
  renderContent(el),   // usa renderCardTreesInto / renderSectionsInto del SDK
  games?, questions, bloques
};
```

El hub, el examen (bloques y recuentos), las flashcards, el buscador y los
deep-links se generan solos a partir de `TEMAS`. Ojo con el nombre: `bloque`
(singular, agrupa **temas**) y `bloques` (plural, sub-bloques de **examen** de un
tema) son cosas distintas.

## Propagar un cambio de diseño a todas las apps

El diseño vive en `styles/` y el comportamiento en `src/`. Al cambiarlos, sube
una versión nueva del SDK (`git tag vX.Y.Z`) y en cada app:

```bash
npm install apuntes-sdk@github:luishidalgoa/apuntes-sdk#vX.Y.Z   # (o npm run sync-sdk)
npm run build   # + redeploy
```

## API pública

`createApp(appConfig, TEMAS)` · helpers de render para los manifiestos
(`renderCard`, `renderCardTreesInto`, `renderSectionsInto`, `renderArtRow`,
`linkify`, `specialTagChip`) · `esc`, `config`, `anchorId`, `revealAnchor`.
Estilos en `apuntes-sdk/styles`.
