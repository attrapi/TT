# -*- coding: utf-8 -*-
"""
Genera el bloque de MODO OSCURO a partir del CSS real de index.html.

No se toca ni una linea del modo claro: se recorre el CSS y por cada regla que
pinte una superficie CLARA (o texto oscuro que quedaria ilegible sobre fondo
oscuro) se emite la regla equivalente bajo `html[data-tema="oscuro"]`, con el
mismo tono pero volteado.

  python gen_oscuro.py            -> imprime el CSS generado
  python gen_oscuro.py --stats    -> resumen
"""
import io, os, re, sys, colorsys

sys.stdout.reconfigure(encoding='utf-8')
# index.html vive dos carpetas arriba (herramientas/modo-oscuro/ -> raiz del repo)
RUTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'index.html')

# Reglas que NO se voltean:
#  .rep-*  -> el reporte PDF se imprime en papel BLANCO, siempre claro.
#  toast / keyframes / scrollbar-thumb / juego-* con color propio -> a mano.
SALTAR_SEL = re.compile(r'^\s*\.rep-|@keyframes|@font-face|@page'
                       # El header es una barra guinda en los DOS temas: lo
                       # blanco de encima (badge TT, avatar, hover de los
                       # botones) tiene que seguir blanco.
                       r'|^\s*\.nav(?![a-z])')

def a_rgb(h):
    h = h.strip().lower()
    if h == 'white':
        return (255, 255, 255)
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def a_hex(r, g, b):
    c = lambda x: max(0, min(255, int(round(x))))
    return '#%02x%02x%02x' % (c(r), c(g), c(b))

def hls(h):
    r, g, b = a_rgb(h)
    return colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

def de_hls(hh, l, s):
    r, g, b = colorsys.hls_to_rgb(hh, max(0.0, min(1.0, l)), max(0.0, min(1.0, s)))
    return a_hex(r * 255, g * 255, b * 255)

def lum(h):
    r, g, b = (c / 255 for c in a_rgb(h))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

# ---------- conversiones ----------
def fondo_oscuro(h):
    """Superficie clara -> superficie oscura del mismo tono."""
    hh, l, s = hls(h)
    L = l * 100
    if h.lower() in ('white', '#fff', '#ffffff'):
        return 'var(--papel)'
    if s < 0.22 and L >= 90:
        return 'var(--papel-2)'          # gris/crema casi blanco
    if s < 0.12:
        return de_hls(0.07, 0.085 + (100 - L) * 0.0018, 0.05)
    nl = 0.115 + (100 - L) * 0.0035
    return de_hls(hh, nl, min(s * 0.55, 0.42))

def texto_claro(h):
    hh, l, s = hls(h)
    if s < 0.10:
        return 'var(--tinta)'
    return de_hls(hh, 0.78, min(max(s, 0.45), 0.72))

def borde_oscuro(h):
    hh, l, s = hls(h)
    L = l * 100
    if s < 0.12:
        return 'var(--linea)'
    if L >= 62:
        return de_hls(hh, 0.26, min(s * 0.6, 0.40))
    return de_hls(hh, min(0.52, l + 0.12), min(s, 0.65))

RE_COLOR = re.compile(r'#[0-9a-fA-F]{3,6}\b|\bwhite\b')
# La familia guinda se queda OSCURA en las variables (son ~63 fondos de boton
# con texto blanco); cuando se usa como TEXTO o BORDE sobre fondo oscuro hay
# que aclararla, y de eso se encarga este mapa.
# (mismo caso para rojo/verde/ambar/azul/grafito y los colores de area).
GUINDA_TXT = {
    'var(--guinda-oscuro)': 'var(--acento)',
    'var(--guinda-claro)':  'var(--acento-claro)',
    'var(--guinda)':        'var(--acento)',
    'var(--rojo)':          'var(--rojo-txt)',
    'var(--verde)':         'var(--verde-txt)',
    'var(--ambar)':         'var(--ambar-txt)',
    'var(--azul)':          'var(--azul-txt)',
    'var(--grafito)':       'var(--grafito-txt)',
    'var(--sub-sgoib)':     'var(--sub-sgoib-txt)',
    'var(--sub-sgoic)':     'var(--sub-sgoic-txt)',
    'var(--sub-sgoi)':      'var(--sub-sgoi-txt)',
    'var(--sub-spac)':      'var(--sub-spac-txt)',
    'var(--sub-enlace)':    'var(--sub-enlace-txt)',
    'var(--sub-sa)':        'var(--sub-sa-txt)',
    'var(--jef-jdpc)':      'var(--jef-jdpc-txt)',
    'var(--jef-jdima)':     'var(--jef-jdima-txt)',
}

def voltear(valor, modo):
    fn = {'fondo': fondo_oscuro, 'texto': texto_claro, 'borde': borde_oscuro}[modo]
    return RE_COLOR.sub(lambda m: fn(m.group(0)), valor)

def voltear_guinda(valor):
    out = valor
    for k in sorted(GUINDA_TXT, key=len, reverse=True):
        out = out.replace(k, GUINDA_TXT[k])
    return out

# ---------- parser ----------
def parsear(css):
    fuera, i, n, pila = [], 0, len(css), []
    while i < n:
        j = css.find('{', i)
        if j < 0:
            break
        cab = ' '.join(css[i:j].split())
        if cab.startswith('@'):
            if cab.startswith('@media') or cab.startswith('@supports'):
                pila.append(cab)
                i = j + 1
                continue
            prof, p = 1, j + 1
            while p < n and prof:
                if css[p] == '{': prof += 1
                elif css[p] == '}': prof -= 1
                p += 1
            i = p
            continue
        fin = css.find('}', j)
        if fin < 0:
            break
        decls = []
        for d in css[j + 1:fin].split(';'):
            d = d.strip()
            if ':' in d:
                p_, v_ = d.split(':', 1)
                decls.append((p_.strip(), v_.strip()))
        if cab:
            fuera.append((pila[-1] if pila else None, cab, decls))
        i = fin + 1
        while pila and re.match(r'\s*\}', css[i:]):
            pila.pop()
            i += re.match(r'\s*\}', css[i:]).end()
    return fuera

def generar():
    s = io.open(RUTA, encoding='utf-8', newline='').read()
    # SOLO el primer <style> (el segundo son los estilos del reporte PDF).
    css = re.findall(r'<style[^>]*>(.*?)</style>', s, re.S)[0]
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    reglas = parsear(css)

    salida, n_reglas = {}, 0
    for media, sel, decls in reglas:
        if SALTAR_SEL.search(sel) or sel.startswith(':root') or 'data-tema' in sel:
            continue
        props = {p.lower(): v for p, v in decls}
        fondo = props.get('background', props.get('background-color', ''))
        lit_fondo = RE_COLOR.findall(fondo)
        # Un fondo "-tenue" es un tinte PALIDO: en oscuro se vuelve oscuro, asi
        # que el texto encima tambien hay que aclararlo. Solo los colores
        # FUERTES (guinda, rojo, sub-...) se saltan: esos siguen oscuros y su
        # texto blanco se lee igual.
        sin_tenues = re.sub(r'var\(--[a-z0-9-]+-tenue\)', '', fondo)
        fondo_ya_oscuro = (bool(lit_fondo) and all(lum(c) <= 0.18 for c in lit_fondo)) \
            or bool(re.search(r'var\(--(guinda|rojo|azul|verde|ambar|grafito|sub-|jef-)', sin_tenues))

        nuevas = []
        for p, v in decls:
            pl = p.lower()
            if pl.startswith('--'):
                continue
            cols = RE_COLOR.findall(v)
            tiene_guinda = any(k in v for k in GUINDA_TXT)
            if pl in ('background', 'background-color', 'background-image'):
                if cols and any(lum(c) > 0.55 for c in cols):
                    nuevas.append((p, voltear(v, 'fondo')))
            elif pl == 'color':
                if fondo_ya_oscuro:
                    continue
                if cols and any(lum(c) < 0.35 for c in cols):
                    nuevas.append((p, voltear(v, 'texto')))
                elif tiene_guinda:
                    nuevas.append((p, voltear_guinda(v)))
            elif 'border' in pl or pl == 'outline':
                if cols and any(lum(c) > 0.55 for c in cols):
                    nuevas.append((p, voltear(v, 'borde')))
                elif tiene_guinda and not fondo_ya_oscuro:
                    nuevas.append((p, voltear_guinda(v)))
        if not nuevas:
            continue
        partes = [x.strip() for x in sel.split(',') if x.strip()]
        pref = ',\n  '.join('html[data-tema="oscuro"] ' + x for x in partes)
        cuerpo = ' '.join('%s: %s;' % (p, v) for p, v in nuevas)
        salida.setdefault(media, []).append('  %s { %s }' % (pref, cuerpo))
        n_reglas += 1

    trozos = []
    if None in salida:
        trozos.append('\n'.join(salida[None]))
    for media, txt in salida.items():
        if media:
            trozos.append('  %s {\n  %s\n  }' % (media, '\n  '.join(txt)))
    return '\n'.join(trozos), n_reglas, len(reglas)

if __name__ == '__main__':
    txt, n, total = generar()
    if '--stats' in sys.argv:
        print('reglas del CSS: %d | volteadas: %d | %d KB' % (total, n, len(txt) // 1024))
    else:
        print(txt)
