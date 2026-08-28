# Ilustrar lo que cuesta entender

> **Pasada de auditoría, posterior a §9.1 del contrato de autoría.** La escribió
> el carril de Legislación a petición del usuario y la publica el SDK, porque es
> de todos los carriles y ninguno es dueño de la materia del otro.
>
> Es **agnóstica de materia a propósito**. Los fallos que corrige no son de
> legislación ni de informática: son de material de estudio. Lo único que cambia
> entre carriles son los ejemplos.

## Cuándo se pasa

Después de escribir o rehacer un tema, **antes de darlo por hecho**. No mientras
redactas: mirando la tarjeta que acabas de escribir todo parece claro, porque
acabas de entenderlo tú. Estos fallos solo aparecen releyendo el resultado.

Ese es el motivo de que esta pasada exista aparte de §9.1. Aquella guía **cómo se
escribe** una tarjeta; esta pregunta **si lo escrito basta**. Son momentos
distintos y por eso una no sustituye a la otra.

## La pregunta

Por cada punto del temario, una sola:

> **¿Qué exactamente no se puede saber leyendo solo este texto?**

Si la respuesta no cabe en **una frase concreta**, no hay nada que ilustrar y
añadir una figura es ruido. Esta pasada tiene que poder decir **que no**: si
termina proponiendo una ilustración para cada punto, no está diagnosticando, está
decorando.

Y si cabe en una frase, esa frase es el **encargo** de la ilustración. Guárdala:
al final se usa para comprobar si ha funcionado.

## Los modos de fallo, y qué forma pide cada uno

La forma **sale del fallo**, no del gusto. Esta es la tabla de decisión:

| Síntoma en el texto | Qué falta | Forma que lo arregla |
|---|---|---|
| Se da una **proporción, mayoría o porcentaje** sin decir sobre qué conjunto se mide | el referente | **parte / todo**: tarta o barra apilada, con el total rotulado |
| **Dos categorías que se confunden** y la definición de cada una no las separa | la frontera | **dos zonas y una línea**, con el criterio escrito en la línea |
| Una **lista larga** que puedes memorizar y aun así fallar | el discriminador | **criba o dos columnas**, con la palabra que decide destacada |
| Una **serie de cifras** en la **misma unidad** | el patrón | **escala graduada** con barras proporcionales al valor |
| Cifras que **parecen comparables y no lo son** (unidades distintas en la misma columna) | la unidad común | **la equivalencia en la propia fila, y el factor** — nunca solo el factor. Y **antes de cualquier escala graduada**: convertir primero |
| **Un mismo término con varios significados** dentro del tema | el desambiguador | **tabla «dónde lo lees / qué significa ahí»**, estática y a la vista. No es una frontera: no son dos cosas, es una palabra |
| **N casos que son el producto de dos ejes**, no una lista | las dos preguntas | **matriz de dos ejes** con las preguntas rotuladas en las cabeceras. Dejas de recordar N nombres y pasas a contestar dos |
| Una **definición abstracta** de algo que el lector no ha tocado nunca | el dato | **el mismo caso concreto** repetido en cada variante |
| Un **proceso con orden** o con estados | la secuencia | **pasos numerados**, o interactivo si el orden importa |
| Una **estructura** (jerarquía, composición, quién contiene a quién) | la forma | **árbol o cajas anidadas** |
| Una regla que **solo se entiende aplicándola** | la experiencia | **simulación**: el lector cambia una entrada y ve moverse el resultado |

La última es la más cara y la que más se abusa. Un interactivo solo se gana su
coste cuando **la lección aparece al mover algo** y no antes. Si el interactivo
enseña lo mismo que enseñaría una foto, haz la foto.

### Ejemplos reales de los dos carriles

Se citan a propósito de las dos materias, para que se vea que el modo de fallo es
el mismo y la asignatura da igual:

- **Falta el referente** — EBEP art. 35: «mayoría absoluta de los miembros de los
  órganos unitarios» sin decir de qué conjunto. Mismo fallo en TAI: «familia de
  columnas = tabla», una equivalencia entre dos cosas que no se enseñan.
- **Falta el discriminador** — EBEP art. 37: acceso y promoción están en los dos
  lados de la criba; lo que decide es *general* frente a *concreta*. Memorizar
  «acceso: excluido» hace fallar la pregunta.
- **Falta la frontera** — EBEP art. 16: carrera y promoción se separan por si
  cambias de cuerpo, no por si asciendes. Sin eso, «ascender de puesto» se
  clasifica mal.
- **Falta el patrón** — EBEP art. 39: 5 · 9 · 13 · 17 · 21 es «empieza en 5 y
  suma 4». Se estaban memorizando cinco números.
- **Falta el dato** — TAI 5.6, dicho por el usuario: *«MongoDB sé lo que es porque
  he trabajado con él, pero hay otros que la teoría es abstracta si no has
  trabajado con ellos»*. La cura fue enseñar **la misma información** en los cinco
  modelos, no definir mejor.

## La forma afirma por su cuenta

Antes de elegir una forma, comprueba que **lo que esa forma da por supuesto es
cierto**. Cada una trae una afirmación de fábrica:

- una **barra o escala** afirma «estas cifras son comparables»;
- una **tarta** afirma «esto es el total, y estas son todas sus partes»;
- una **matriz** afirma «estos dos ejes son independientes»;
- **dos zonas y una línea** afirman «todo cae a un lado o al otro».

Si la afirmación es falsa, la figura miente **con aspecto de rigor**, que es peor
que no tenerla. Dos casos reales, uno de cada carril:

- **TAI**, tabla de interfaces: la columna «Velocidad» mezclaba giga**bits** (SATA,
  SAS) y giga**bytes** (NVMe). Leída de arriba abajo, SAS-4 con 22,5 «ganaba» a
  NVMe con 15,75, cuando es al revés por un factor de 8. Un gráfico de barras
  habría dibujado la mentira a escala.
- **Legislación**, tarta del art. 35: la forma afirmaba «esto es la Mesa entera» y
  solo había sindicatos. El párrafo de debajo lo desmentía y **dio igual**.

De aquí sale la regla dura: **un texto no corrige lo que la forma afirma**. Se
arregla la forma, o se pone la corrección *antes*, o se elige otra forma.

## Cómo saber si ha funcionado

1. **Enuncia la frase.** «Después de ver esto, se sabe que ___, y antes no se
   sabía.» Si no puedes escribirla, la ilustración es decoración: quítala.
2. **Enseña el dato, no lo nombres.** Una figura que repite el texto con cajas no
   añade nada. Si el texto dice «cinco principios» y la figura dice «5
   principios», sobra.
3. **Quita una parte y mira.** Si la lección no cambia, esa parte era adorno.
4. **Trae el contraejemplo cuando lo haya.** El caso que *no* cumple enseña más
   que otro que sí: en el art. 35, «50 es la mitad exacta y NO basta» vale más que
   dos ejemplos válidos.
5. **Contrasta contra el banco de preguntas antes de decidir.** Lo bonito de
   dibujar y lo que cae no siempre coinciden. En el Tema 5 de TAI, lo único
   ilustrable de una tarjeta —RDB frente a AOF— no se pregunta nunca, mientras que
   lo que sí cae es atribución de producto, que no tiene forma. Ahí el «no» es la
   respuesta correcta.
6. **Números redondos a propósito.** El caso del art. 35 usa 100 escaños para que
   la mayoría absoluta se lea sin calcular. Un ejemplo con cifras feas obliga a
   hacer aritmética y tapa la idea.

## Trampas caras, todas ocurridas

**Ilustrar algo que ya no está.** Al declarar `omitir` sobre un artículo no se
revisó qué otras tarjetas se apoyaban en él, y quedó un truco defendiendo de una
confusión con contenido retirado del temario. **Una omisión no solo retira un
artículo: deja huérfano lo que otros digan de él.** Al omitir, buscar el número
del artículo en el resto del tema.

**Una figura que no monta puede pasar `verify`.** Si la tarjeta se pinta entera y
el HTML sigue siendo válido, el verificador da el visto bueno aunque el contenido
de dentro falte. Le ocurrió al carril de TAI dos veces el mismo día por retocar
código con **sustituciones de texto**: un pase que reponía acentos se los puso al
nombre de un atributo (`data-jerarquias`) y la escena dejó de montar en silencio.
Al terminar una figura, comprueba en el DOM que **contiene lo que debía contener**
—cuenta los elementos, no mires si «aparece»—; y desconfía de los `replace` sobre
código, que aciertan en el 99 % de las líneas y estropean la que importa.

**Medir lo que no es.** Comprobar que algo se ve leyendo `textContent` no prueba
nada: el texto de un elemento oculto se lee igual. Medir la clase o el `display`.
Y en el navegador, fijar el viewport antes de medir — un panel sin dimensionar da
anchos de 34 px que parecen un bug de maquetación y no lo son.

## Lo que ya está resuelto en otra parte, no lo repitas

- **Mecánica visual** (paleta, jerarquía tipográfica, `reveal`, el `viewBox` que
  encoge el texto en los dos ejes, reservar altura por bloque): **§9.2**. Esta
  pasada decide *qué* ilustrar; aquella dice *cómo* no romperlo.
- **Regla práctica que sale de §9.2 y conviene tener a mano**: el SVG es para lo
  que **tiene coordenadas**. Los rótulos, fuera. Un diagrama con prosa dentro del
  `viewBox` se lee a la mitad de tamaño en un móvil, y si es ancha desaparece por
  los lados sin dejar rastro. Cuando la figura es sobre todo texto y cajas —una
  criba, dos zonas comparadas, una escalera—, hazla en **HTML**: los tamaños son
  reales y reflota sola.

> Los tres modos de fallo de unidades, término ambiguo y matriz de dos ejes, la
> guarda de la escala graduada y la comprobación contra el banco los aportó el
> **carril de TAI** al pasar el borrador por informática. Era lo que le faltaba
> para dejar de serlo: una materia técnica tiene formas de costar de entender que
> la de legislación no tiene.

## Checklist

- [ ] He recorrido **todos** los puntos del tema, no solo los que me apetecía dibujar.
- [ ] Para cada uno he escrito la frase de «qué no se puede saber leyendo», o he decidido que no hay ninguna.
- [ ] Hay puntos **sin** ilustración, y puedo decir por qué no la necesitan.
- [ ] Cada figura contesta su frase, y la frase está escrita en el comentario del código.
- [ ] Hay contraejemplo donde lo hay.
- [ ] La figura no afirma nada que el texto tenga que desmentir después.
- [ ] Ninguna figura se apoya en contenido declarado `omitir` o retirado.
- [ ] **Lo que ilustro se pregunta** — contrastado contra el banco, no elegido por vistosidad.
- [ ] **La forma no afirma nada falso**: si es escala, las cifras están en la misma unidad; si es tarta, el total es de verdad el total.
- [ ] La figura **monta**: contados en el DOM los elementos que debía tener, no solo comprobado que la tarjeta se pinta.
- [ ] Medido en el navegador a **375 px y a ~1100 px**: sin desbordes, y el texto de la figura en píxeles reales legibles.

## Lo único de aquí que caza una herramienta

`npm run verify` avisa (`referencia-huerfana`) cuando **una tarjeta viva menciona
un artículo declarado `omitir`**. Es el único de estos modos de fallo que se
detecta solo; los demás piden releer, que es de lo que va esta pasada.

Al estrenarlo apareció un caso que nadie había visto: la tarjeta del art. 1 del
EBEP remite a «→ art. 20» para acotar a quién se aplica, y el art. 20 está
declarado `omitir`. Manda a leer algo que ya no está.

Empareja **por ley y no por número**: en un tema donde conviven dos normas, el
art. 20 del EBEP y el 20 de la Ley de Transparencia son cosas distintas, y
comparar cifras acusaba a tarjetas de Transparencia de apoyarse en artículos del
EBEP. Si tu tema mezcla normas, cada tarjeta debe poder decir de cuál es —lo dice
su clave, `EBEP-20` frente a `20`—.
