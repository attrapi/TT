# -*- coding: utf-8 -*-
"""
Arma el bloque de estilos temaOscuro de index.html con tres piezas, en este orden:
  1) tema-core.css      (la paleta, a mano)
  2) gen_oscuro.py      (las ~440 reglas volteadas del CSS real)
  3) tema-ajustes.css   (los remates a mano; van al final para que ganen)

Es IDEMPOTENTE: reemplaza lo que haya entre los marcadores, así que se puede
correr las veces que haga falta mientras se afina el tema.
"""
import io, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import gen_oscuro

# index.html vive dos carpetas arriba (herramientas/modo-oscuro/ -> raiz del repo)
RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')
INI = '/* ===== INICIO MODO OSCURO (armado por build_tema.py) ===== */'
FIN = '/* ===== FIN MODO OSCURO ===== */'

def leer(n):
    return io.open(os.path.join(AQUI, n), encoding='utf-8', newline='').read().rstrip()

def main():
    generado, n, total = gen_oscuro.generar()
    cuerpo = '\n'.join([
        INI,
        '  /* Modo oscuro. El modo claro NO se toca: todo lo de aquí vive bajo',
        '     html[data-tema="oscuro"], que solo existe cuando se prende.',
        '     El bloque 2 lo genera scratchpad/gen_oscuro.py leyendo el CSS real',
        '     y volteando cada superficie clara; por eso son tantas reglas y por',
        '     eso no hay que mantenerlas a mano. */',
        '',
        leer('tema-core.css'),
        '',
        '  /* ---------------------------------------------------------------',
        '     2) GENERADO: %d reglas volteadas de las %d del CSS.' % (n, total),
        '     --------------------------------------------------------------- */' ,
        generado,
        '',
        leer('tema-ajustes.css'),
        FIN,
    ])

    s = io.open(RUTA, encoding='utf-8', newline='').read()
    if INI in s:
        i, j = s.index(INI), s.index(FIN) + len(FIN)
        s = s[:i] + cuerpo + s[j:]
        accion = 'actualizado'
    else:
        # Se inserta como <style> propio JUSTO DESPUÉS del CSS base (el primer
        # </style>), para que gane en el cascade sin tocar nada de lo de arriba.
        m = re.search(r'</style>', s)
        ins = '</style>\n<style id="temaOscuro">\n' + cuerpo + '\n</style>'
        s = s[:m.start()] + ins + s[m.end():]
        accion = 'insertado'
    io.open(RUTA, 'w', encoding='utf-8', newline='').write(s)
    print('tema %s: %d reglas generadas, %d KB' % (accion, n, len(cuerpo) // 1024))

if __name__ == '__main__':
    main()
