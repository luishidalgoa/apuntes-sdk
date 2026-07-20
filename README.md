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

```bash
npx apuntes-crear-app mi-temario --titulo "Mi asignatura"
cd mi-temario && npm install && npm run dev
```

Eso te deja una app funcionando (con dos temas de ejemplo, examen, minijuegos y
glosario) en menos de un minuto. Luego sustituyes el contenido por el tuyo y
`npm run verify` audita que cumple el contrato del SDK.

**Guía completa paso a paso: [`docs/crear-temario.md`](docs/crear-temario.md).**

> **¿Vas a montar un tema con una IA?** Pásale
> [`docs/SKILL-crear-tema.md`](docs/SKILL-crear-tema.md) junto con tu material
> (un PDF, tus apuntes). Es un contrato autosuficiente —manifiesto, recetas de
> cada patrón, reglas de diseño y checklist de verificación— pensado para que
> cualquier IA produzca un tema válido **sin conocer el resto del SDK**.

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
  games?, questions,
  apartados,           // sub-bloques de EXAMEN del tema (filtro de preguntas). Desde
                       // v0.1.25 se llama `apartados` (antes `bloques`, aún aceptado).
  glossary?            // (OPCIONAL) amplía el glosario de acrónimos solo para este tema
};
```

El hub, el examen (apartados y recuentos), las flashcards, el buscador y los
deep-links se generan solos a partir de `TEMAS`. Ojo con los nombres, que se
parecen pero son cosas distintas: `bloque` (singular, agrupa **temas** — capa de
navegación) vs `apartados` (sub-bloques de **examen** de un tema, para filtrar
preguntas; `q.apartado` en cada pregunta). No confundir con los `apartados` de un
artículo (`sections.<clave>.apartados = [{n,text}]`, los puntos numerados del
texto).

**Glosario de acrónimos.** Cada asignatura aporta su glosario
`appConfig.glossary = { 'AGE':'Administración General del Estado', … }` (con
override opcional por tema, `tema.glossary`). El SDK hace clicables sus
apariciones en el contenido, mostrando el título completo en un rótulo. Enlaza
**SOLO contra la lista blanca** del glosario (nunca "cualquier mayúscula") y
**normaliza la puntuación** (`CCAA` ≡ `CC.AA.`). Ver la guía para el formato.

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
