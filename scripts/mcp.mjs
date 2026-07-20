#!/usr/bin/env node
/* `apuntes-mcp` — servidor MCP de autoría de temarios.

   Expone como HERRAMIENTAS lo que ya está probado por línea de comandos, para
   que cualquier cliente MCP (Claude Desktop, Claude Code, Cursor…) pueda montar
   una asignatura sin que el usuario toque ficheros ni conozca el SDK.

   ALCANCE DELIBERADO: solo verbos que envuelven herramientas ya validadas
   (crear app, leer el contrato, listar/leer temas, verificar, compilar). NO hay
   `añadir_simulador` todavía: se diseñaría contra un catálogo de un solo
   componente sin migración real, y saldría una API inventada. Cuando el
   catálogo madure, entra aquí.

   La pieza más útil es `verificar`: devuelve los hallazgos como DATOS, no como
   texto, para que el modelo pueda corregirse solo en bucle. */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const SDK_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const texto = (t) => ({ content: [{ type: 'text', text: t }] });
const json = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] });

/* Ejecuta un script del SDK y devuelve salida + código. */
function correr(script, args, cwd){
  const r = spawnSync(process.execPath, [join(SDK_ROOT, 'scripts', script), ...args],
    { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, out: ((r.stdout || '') + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '').trim() };
}
function npm(args, cwd){
  const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args,
    { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  return { code: r.status ?? 1, out: ((r.stdout || '') + (r.stderr || '')).replace(/\x1b\[[0-9;]*m/g, '').trim() };
}

const server = new McpServer({ name: 'apuntes-sdk', version: JSON.parse(readFileSync(join(SDK_ROOT, 'package.json'), 'utf8')).version });

/* ── El contrato, servido por el protocolo ─────────────────────────────────
   Que la IA pueda PEDIR el contrato es lo que la hace autónoma: no depende de
   que alguien acuerde de pegarle el documento. */
server.registerTool('leer_contrato', {
  title: 'Leer el contrato de autoría',
  description: 'Devuelve el contrato completo para crear un tema (manifiesto, contrato DOM, recetas por patrón, reglas de diseño, errores frecuentes y checklist). LÉELO ANTES de crear o editar cualquier tema.',
  inputSchema: {}
}, async () => {
  const p = join(SDK_ROOT, 'docs', 'SKILL-crear-tema.md');
  if(!existsSync(p)) return texto('No encuentro el contrato en el paquete del SDK.');
  return texto(readFileSync(p, 'utf8'));
});

/* ── Crear una asignatura ──────────────────────────────────────────────── */
server.registerTool('crear_app', {
  title: 'Crear una asignatura nueva',
  description: 'Crea una app de temario a partir de la plantilla oficial (2 temas de ejemplo, examen, minijuegos, glosario). Devuelve la ruta y los siguientes pasos.',
  inputSchema: {
    carpeta: z.string().describe('Ruta de la carpeta a crear (no debe existir o estar vacía)'),
    titulo: z.string().optional().describe('Título de la asignatura, p.ej. "Biología 2º Bach"'),
    instalar: z.boolean().optional().describe('Ejecutar npm install al terminar (por defecto sí)')
  }
}, async ({ carpeta, titulo, instalar = true }) => {
  const args = [carpeta]; if(titulo) args.push('--titulo', titulo);
  const r = correr('crear-app.mjs', args, process.cwd());
  if(r.code !== 0) return json({ ok: false, salida: r.out });
  const dest = resolve(carpeta);
  const inst = instalar ? npm(['install'], dest) : null;
  return json({
    ok: true, ruta: dest,
    instalado: inst ? inst.code === 0 : false,
    siguiente: 'Llama a `leer_contrato`, sustituye el contenido de src/temas/ y valida con `verificar`.',
    salida: r.out
  });
});

/* ── Inspeccionar los temas ────────────────────────────────────────────── */
server.registerTool('listar_temas', {
  title: 'Listar los temas de una app',
  description: 'Devuelve los temas registrados con su id, título, nº de preguntas y si tienen glosario. Útil para saber qué hay antes de tocar nada.',
  inputSchema: { ruta: z.string().describe('Ruta de la app (la que contiene src/registry.js)') }
}, async ({ ruta }) => {
  const reg = join(resolve(ruta), 'src', 'registry.js');
  if(!existsSync(reg)) return json({ ok: false, error: `No encuentro ${reg}` });
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const m = await import(${JSON.stringify('file:///' + reg.replace(/\\\\/g, '/'))});
    const t = (m.TEMAS || m.default || []).map(x => ({
      id: x.id, titulo: x.titulo, materia: x.materia ?? null,
      preguntas: (x.questions || []).length, glosario: Object.keys(x.glossary || {}).length
    }));
    console.log(JSON.stringify(t));
  `], { encoding: 'utf8' });
  if(r.status !== 0) return json({ ok: false, error: (r.stderr || '').trim().split('\n').slice(0, 4).join('\n') });
  return json({ ok: true, temas: JSON.parse(r.stdout.trim()) });
});

/* ── Verificar: el verbo que cierra el bucle ───────────────────────────── */
server.registerTool('verificar', {
  title: 'Verificar el contrato de los temas',
  description: 'Audita TODOS los temas de la app: manifiesto, ids duplicados, tarjetas invisibles al buscador, botones atrapados, APIs de navegador que rompen las herramientas, glosario y preguntas. Devuelve los hallazgos ESTRUCTURADOS para poder corregirlos. Ejecútalo siempre después de crear o editar un tema.',
  inputSchema: { ruta: z.string().describe('Ruta de la app') }
}, async ({ ruta }) => {
  const r = correr('verify.mjs', ['src/registry.js'], resolve(ruta));
  /* Reconstruye los hallazgos del informe para que el modelo no tenga que
     interpretar texto de consola. */
  const hallazgos = [];
  let tema = null;
  for(const linea of r.out.split('\n')){
    const mt = linea.match(/^(\S.*)$/);
    const mf = linea.match(/^\s+([✗!])\s+\S+\s+\[([\w-]+)\]\s+(.*)$/);
    if(mf) hallazgos.push({ tema, nivel: mf[1] === '✗' ? 'error' : 'aviso', codigo: mf[2], mensaje: mf[3].trim() });
    else if(mt && !linea.startsWith(' ') && !linea.startsWith('─') && !/tema\(s\)|^✓|^✗/.test(linea)) tema = linea.trim();
  }
  return json({
    ok: r.code === 0,
    errores: hallazgos.filter(h => h.nivel === 'error').length,
    avisos: hallazgos.filter(h => h.nivel === 'aviso').length,
    hallazgos,
    informe: r.out
  });
});

/* ── Compilar ──────────────────────────────────────────────────────────── */
server.registerTool('compilar', {
  title: 'Compilar la app',
  description: 'Compila la app a un único HTML autocontenido. Verifica antes: si hay errores de contrato, no compila y te los devuelve.',
  inputSchema: { ruta: z.string().describe('Ruta de la app') }
}, async ({ ruta }) => {
  const dest = resolve(ruta);
  const v = correr('verify.mjs', ['src/registry.js'], dest);
  if(v.code !== 0) return json({ ok: false, fase: 'verificar', motivo: 'Hay errores de contrato; corrígelos antes de compilar.', informe: v.out });
  const b = npm(['run', 'build'], dest);
  return json({ ok: b.code === 0, fase: 'compilar', salida: b.out.split('\n').slice(-6).join('\n') });
});

await server.connect(new StdioServerTransport());
