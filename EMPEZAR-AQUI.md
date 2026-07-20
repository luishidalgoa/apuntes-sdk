# Empezar aquí

Convierte tus apuntes en una **app de estudio interactiva**: tarjetas con truco,
examen que baraja y explica al fallar, marcapáginas, subrayado, buscador, plan
de estudio por prioridad, glosario de siglas clicable y minijuegos. Compila a un
**único `index.html`** que funciona sin conexión. Sirve para **cualquier
asignatura** — tú solo pones el contenido.

## Lo único que necesitas

- **Node.js 18 o superior** — [nodejs.org](https://nodejs.org). Es el único requisito.
- *(Recomendado)* una IA (Claude, ChatGPT, Cursor…) para que te monte los temas
  desde tus PDFs. No hace falta saber programar.

---

## Camino rápido (con IA) — 3 pasos

### 1. Crea tu app

Sin instalar nada global, un solo comando:

```bash
npx --package "github:luishidalgoa/apuntes-sdk#v0.2.1" apuntes-crear-app mi-temario --titulo "Mi asignatura"
cd mi-temario
npm install
npm run dev
```

Se abre en el navegador con **dos temas de ejemplo** (con simulador, examen y
minijuegos) para que veas cómo queda. Esos los sustituirás por lo tuyo.

### 2. Deja que tu IA monte tus temas

El SDK trae un **contrato de autoría** pensado para que cualquier IA cree un
tema válido sin conocer el SDK. Está en:

```
node_modules/apuntes-sdk/docs/SKILL-crear-tema.md
```

Ábrelo, pásaselo a tu IA junto con tu PDF y pídele:

> «Aquí tienes el contrato de autoría (SKILL-crear-tema.md) y el PDF de mi tema.
> Crea un tema en `src/temas/` siguiendo el contrato y regístralo en
> `src/registry.js`.»

**¿Tu IA soporta MCP?** (Claude Desktop, Claude Code, Cursor…) Conéctala al
servidor del SDK y no tendrás ni que copiar ficheros:

```jsonc
{ "mcpServers": { "apuntes": { "command": "npx", "args": ["-y", "--package", "github:luishidalgoa/apuntes-sdk#v0.2.1", "apuntes-mcp"] } } }
```

Luego, en el chat: *«monta el tema de este PDF»*. La IA crea, verifica y compila
llamando a las herramientas ella sola.

### 3. Comprueba y publica

```bash
npm run verify   # audita que tus temas cumplen el contrato (0 errores)
npm run build    # genera dist/index.html — un único archivo, súbelo donde quieras
```

`npm run verify` es tu red de seguridad: te dice **qué está mal y por qué
importa** (ids duplicados, tarjetas que no saldrán en el buscador, siglas sin
glosario, preguntas mal formadas…). Págalo antes de dar un tema por hecho.

---

## Camino a mano (sin IA)

1. Copia `src/temas/tema1/` a `src/temas/mi-tema/`.
2. Cambia su contenido siguiendo el ejemplo y el contrato (§ de
   [`docs/SKILL-crear-tema.md`](docs/SKILL-crear-tema.md)).
3. Añade una línea en `src/registry.js`.
4. `npm run verify` y `npm run dev`.

---

## ¿Y ya está?

Sí. El examen, el buscador, el plan de estudio, el marcapáginas y las flashcards
**se generan solos** a partir de tus temas. No configuras nada de eso: solo
aportas el contenido, y el SDK pone toda la maquinaria.

Cuando quieras algo interactivo (una simulación, una diapositiva que explique un
concepto paso a paso), el SDK trae el motor `mountStepper` — el contrato explica
cómo usarlo y, más importante, **cuándo** conviene.

> Guía completa de montaje de la app: [`docs/crear-temario.md`](docs/crear-temario.md).
