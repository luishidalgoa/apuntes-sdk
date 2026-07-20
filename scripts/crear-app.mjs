#!/usr/bin/env node
/* `apuntes-crear-app` — crea una asignatura nueva a partir de la plantilla viva
   (examples/starter), que es la MISMA que valida el CI. Así el esqueleto que
   recibe el usuario no puede pudrirse: si se rompe, el CI lo canta.

   Uso:  apuntes-crear-app <carpeta> [--titulo "Mi asignatura"] */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';

const RESET = '\x1b[0m', RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', B = '\x1b[1m', CYA = '\x1b[36m';

const argv = process.argv.slice(2);
const destArg = argv.find(a => !a.startsWith('--'));
const tIdx = argv.indexOf('--titulo');
if(!destArg){
  console.error(`${RED}✗ Falta la carpeta de destino.${RESET}\n` +
    `  Uso:  apuntes-crear-app mi-temario [--titulo "Mi asignatura"]`);
  process.exit(2);
}
const dest = resolve(destArg);
const nombre = basename(dest);
const titulo = tIdx >= 0 ? argv[tIdx + 1] : nombre.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

if(existsSync(dest) && readdirSync(dest).length){
  console.error(`${RED}✗ La carpeta ya existe y no está vacía:${RESET} ${dest}`);
  process.exit(2);
}

/* La plantilla viaja dentro del paquete del SDK. */
const sdkRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const starter = join(sdkRoot, 'examples', 'starter');
if(!existsSync(starter)){
  console.error(`${RED}✗ No encuentro la plantilla${RESET} (${starter}).`);
  process.exit(2);
}
const sdkVersion = JSON.parse(readFileSync(join(sdkRoot, 'package.json'), 'utf8')).version;

/* ---------- copiar, saltando lo que debe regenerarse ---------- */
const SALTAR = new Set(['node_modules', 'dist', 'package-lock.json', '.vite']);
mkdirSync(dest, { recursive: true });
for(const entry of readdirSync(starter)){
  if(SALTAR.has(entry)) continue;
  const from = join(starter, entry), to = join(dest, entry);
  if(statSync(from).isDirectory()) cpSync(from, to, { recursive: true, filter: (s) => !SALTAR.has(basename(s)) });
  else cpSync(from, to);
}

/* ---------- personalizar ---------- */
const edit = (rel, fn) => {
  const p = join(dest, rel);
  if(!existsSync(p)) return;
  writeFileSync(p, fn(readFileSync(p, 'utf8')));
};

edit('package.json', (s) => {
  const p = JSON.parse(s);
  p.name = nombre.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  p.description = `${titulo} — temario interactivo sobre apuntes-sdk`;
  /* La app nueva es independiente: apunta al SDK publicado, no al symlink local. */
  p.dependencies = { 'apuntes-sdk': `git+https://github.com/luishidalgoa/apuntes-sdk.git#v${sdkVersion}` };
  p.scripts = Object.assign({ dev: 'vite', build: 'vite build', preview: 'vite preview', verify: 'apuntes-verify' }, {});
  return JSON.stringify(p, null, 2) + '\n';
});
edit('index.html', (s) => s.replace(/<title>[^<]*<\/title>/, `<title>${titulo}</title>`));

/* Glosario compartido de la materia, ya cableado: nace vacío pero visible, para
   que "mantener un glosario por materia" sea un paso obvio y no algo que se
   redescubre a mano en cada asignatura. */
const glosPath = join(dest, 'src', 'glosario.js');
if(!existsSync(glosPath)) writeFileSync(glosPath,
`/* Glosario de acrónimos de ESTA materia (uno compartido por todos sus temas).
   El SDK hace clicables sus apariciones en el contenido y muestra el título.

   POR QUÉ por materia y no en el appConfig global: las claves colisionan entre
   materias — 'IT' es Incapacidad Temporal en Derecho pero Information Technology
   en Informática. Cada materia fija su significado importando este fichero.

   Reglas (ver §6 del skill): claves de 2+ letras, con la grafía EXACTA del texto
   (distingue mayúsculas), y que aparezcan de verdad en la prosa. */
export const GLOSARIO = {
  // 'ADN': 'Ácido desoxirribonucleico',
  // 'CPU': 'Central Processing Unit',
};
`);
edit('src/temas/tema1/index.js', (s) =>
  /import\s*\{[^}]*GLOSARIO/.test(s) ? s :
  s.replace(/^(import [^\n]*\n)/m, `$1import { GLOSARIO } from '../../glosario.js';\n`)   // [^\n]* incluye \r (CRLF)
   .replace(/(\n\s*renderContent\s*\()/, `\n  glossary: GLOSARIO,$1`));
edit('src/main.js', (s) => s
  .replace(/title:\s*'[^']*'/, `title: '${titulo.replace(/'/g, "\\'")}'`)
  .replace(/eyebrow:\s*'[^']*'/, `eyebrow: '${titulo.replace(/'/g, "\\'")}'`));

/* ---------- listo ---------- */
console.log(`\n${GRN}✓ Creada${RESET} ${B}${titulo}${RESET} en ${CYA}${dest}${RESET}`);
console.log(`${DIM}  Plantilla: 2 temas de ejemplo (uno con simulador), examen, minijuegos y glosario.${RESET}\n`);
console.log(`${B}Siguiente:${RESET}`);
console.log(`  cd ${destArg}`);
console.log(`  npm install`);
console.log(`  npm run dev        ${DIM}# abre la app${RESET}`);
console.log(`\n${B}Para crear tus temas:${RESET}`);
console.log(`  1. Sustituye el contenido de ${CYA}src/temas/tema1/${RESET} por el tuyo.`);
console.log(`  2. Registra cada tema nuevo en ${CYA}src/registry.js${RESET}.`);
console.log(`  3. ${B}npm run verify${RESET} audita que cumplen el contrato del SDK.`);
console.log(`\n${DIM}  ¿Lo vas a montar con una IA? Pásale docs/SKILL-crear-tema.md del SDK${RESET}`);
console.log(`${DIM}  junto con tu material (un PDF, tus apuntes): es un contrato autosuficiente.${RESET}\n`);
