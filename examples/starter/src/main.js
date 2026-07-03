/* Punto de entrada de la app demo. Estilos del SDK + paleta propia, luego
   createApp con la config de la asignatura y el registro de temas. */
import 'apuntes-sdk/styles';
import './palette.css';
import { createApp } from 'apuntes-sdk';
import { TEMAS } from './registry.js';

createApp({
  title: 'Sistema Solar',
  eyebrow: 'Demo · SDK de apuntes',
  lede: 'Ejemplo mínimo de una asignatura montada solo con el SDK (nada de legislación): secciones en tarjetas, texto fuente, examen y minijuegos.',
  examLede: 'Preguntas de la demo, filtrables por bloque, con temporizador opcional y asistente de dudas.',
  footer: 'Demo del SDK de apuntes — plantilla para crear una asignatura nueva.',
  aiSystemPrompt: 'Eres un tutor de astronomía básica. Responde en español, claro y breve (4-5 frases), centrado en la duda concreta. Si no estás seguro de un dato, dilo en vez de inventarlo.',
  anchorPrefix: 'sec-'
}, TEMAS);
