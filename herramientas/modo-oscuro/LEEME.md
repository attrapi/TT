# Modo oscuro — cómo está hecho y cómo se rehace

El CSS de la app son ~5,800 líneas con más de 500 colores escritos a mano. Un
modo oscuro hecho a mano ahí es imposible de mantener: cada vez que alguien
agrega una pantalla nueva habría que acordarse de escribir su versión oscura, y
tarde o temprano aparece un recuadro blanco que ciega.

Por eso el tema **se genera leyendo el CSS real**. El modo claro no se toca ni
una línea: todo lo del tema vive bajo `html[data-tema="oscuro"]`, que solo
existe cuando el usuario lo prende.

## Las tres piezas

`build_tema.py` arma el bloque de estilos `temaOscuro` de `index.html` con
estas tres, **en este orden** (las de abajo ganan):

1. **`tema-core.css`** — la paleta. Superficies, texto, líneas y los colores de
   área. Es lo único que hay que tocar para cambiar el "sabor" del tema.
2. **`gen_oscuro.py`** — recorre el CSS real y, por cada regla que pinte una
   superficie clara (o texto oscuro que quedaría ilegible), emite su versión
   volteada. Hoy son ~438 reglas. **No se editan a mano**: se regeneran.
3. **`tema-ajustes.css`** — los remates que el generador no puede adivinar
   (sombras, barras de scroll, el semáforo de las tarjetas, el botón y su
   burbuja).

## Rehacerlo

Después de tocar el CSS de la app (o cualquiera de los dos `.css` de aquí):

    cd herramientas/modo-oscuro
    python build_tema.py

Es idempotente: reemplaza lo que haya entre los marcadores
`/* ===== INICIO MODO OSCURO ... */` y `/* ===== FIN MODO OSCURO ===== */`.
Correrlo dos veces da el mismo resultado.

Para ver solo lo que saldría, sin escribir nada:

    python gen_oscuro.py --stats     # resumen
    python gen_oscuro.py             # el CSS

## Dos reglas que no son obvias

**La guinda no se aclara.** Es el fondo de ~100 botones y píldoras que llevan
texto BLANCO encima; si se aclarara, el blanco dejaría de leerse. Lo mismo con
los colores de área (`--sub-*`, `--rojo`, `--verde`…). Para cuando esos mismos
colores se usan como TEXTO o BORDE sobre fondo oscuro existe su gemelo `-txt`,
que sí es claro — y el generador hace ese cambio solo.

**El reporte PDF se queda claro.** Se imprime en papel blanco, así que
`gen_oscuro.py` salta los selectores `.rep-*`. De todos modos el reporte se abre
en otra ventana con su propio HTML, así que el tema nunca lo alcanza.

**El header tampoco se voltea.** Es una barra guinda en los dos temas, así que
lo blanco de encima (el badge TT, el avatar, el hover de los botones) tiene que
seguir blanco. Por eso `.nav*` está en la lista de saltos.

## Cómo se verificó

Se auditó con el navegador contra la app corriendo: un script recorre lo que
está VISIBLE en cada vista y mide (a) superficies claras que se hayan quedado
sin voltear y (b) contraste de cada texto contra su fondo real, con el mínimo de
WCAG AA (4.5:1, o 3:1 si la letra es grande o negrita).

Se revisaron 12 vistas —tablero, historial, bitácora, volantes, reportes,
asistencia, seguimiento, enlaces, calendario, indicadores, el modal de una tarea
y el formulario de captura— en claro y en oscuro. Lo que encontró y se corrigió:

- `--tinta-tenue` se quedaba en 4.2:1 → se subió a #9C938C.
- El pulgar de las barras de scroll salía casi blanco: faltaba declarar
  `::-webkit-scrollbar` (el ancho); sin esa regla Chrome ignora `track` y `thumb`.
- El logo TT se pintaba con `currentColor` y salía rosa: se fijó en guinda.
- El generador estaba volteando cosas del header, que ya es guinda en ambos temas.
