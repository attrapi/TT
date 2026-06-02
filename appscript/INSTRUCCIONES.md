# Login real con Google Apps Script (usuario / contraseña + lista)

Objetivo: que la app pida **iniciar sesión** y que solo entren las personas de
tu **lista**, leyendo las hojas de SPAC de forma **privada** (ya no como CSV
público).

> La app sigue funcionando en GitHub en "modo demo" (selección de perfil).
> El login real aparece cuando se abre desde la URL del **Web App** de Apps Script.

---

## Paso 1 — Crear la hoja "Usuarios" (la lista de permitidos)

En cualquiera de tus Google Sheets (o uno nuevo), crea una pestaña llamada
**`Usuarios`** con estos encabezados en la fila 1 (exactos):

| Usuario | Contraseña | Nombre | Rol | Subdireccion | Jefatura | Activo |
|---|---|---|---|---|---|---|
| adrian.tavares@attrapi.gob.mx | (clave) | Ing. Adrián Tavares | Director | TODAS | | Si |
| mario@gmail.com | (clave) | MARIO | Capturista | SPAC | | Si |

- **Usuario**: el correo o nombre de acceso (puede ser de cualquier dominio).
- **Contraseña**: la clave (texto). *Recomendación:* manténla en una hoja
  privada; más adelante la podemos guardar cifrada.
- **Rol**: `Director` o `Capturista`.
- **Subdireccion**: `TODAS` (Director), o `SA` / `SGOI` / `SPAC` / `ENLACE`.
- **Jefatura**: déjalo vacío (reservado por si después hay perfiles de jefatura).
- **Activo**: `Si` para permitir el acceso; `No` para bloquear sin borrar.

Anota el **ID** de ese archivo (de la URL: `.../spreadsheets/d/`**`ESTE_ID`**`/edit`).

---

## Paso 2 — Estructura: un archivo por área

Desde la migración al Drive nuevo, **cada área es su propio Google Sheet**
(antes había un archivo central de jefaturas y SGOI tenía 3 pestañas juntas).
Las áreas y su pestaña son: **DPAC, SPAC, JDPC, JDIMA, SGOI, JDGA, JDGOI, SA,
STAFF**. Las pestañas de sistema (**Usuarios, Estados, Bitacora, Areas**) viven
dentro del archivo de **SPAC**.

Los **IDs ya están puestos** dentro de `guardarConfiguracion()` en `Codigo.gs`
(no hay que copiar nada a mano salvo que cambie algún archivo).

> Nota — "Staff" antes era "Enlace". El archivo/carpeta se llaman **STAFF**,
> pero el **código interno sigue siendo `ENLACE`** (lo que la app ya entiende).
> ⚠️ En la hoja **Usuarios**, a la gente de Staff ponle **Subdireccion =
> `ENLACE`** (no `STAFF`), o el front no los reconocerá.

> Con el login privado **no necesitas** "Publicar en la web" estas hojas; el
> script las lee con tu permiso de dueño. Pueden quedar privadas.

---

## Paso 3 — Crear el proyecto de Apps Script y guardar la configuración

1. Con la **cuenta nueva** (la dueña del Drive), entra a
   <https://script.google.com> → **Nuevo proyecto**.
2. Borra lo que traiga y **pega** el contenido de `Codigo.gs` (este repo).
3. Guarda (💾). En el selector de función elige **`guardarConfiguracion`** y
   pulsa **Ejecutar ▶** (autoriza si lo pide). Esto guarda los IDs en las
   **Propiedades del script**.
   - 🎉 A partir de aquí, **re-pegar el código ya NO borra los IDs**. Solo
     vuelve a correr `guardarConfiguracion` si quieres **cambiar** algún dato.
4. Elige **`autorizar`** y **Ejecutar ▶**: obliga a Google a pedir TODOS los
   permisos (incluido escribir en Drive para los adjuntos). Acepta el diálogo.
5. (Solo si las hojas nuevas traen filas **sin ID** en la columna ID) elige
   **`asignarIds`** y **Ejecutar ▶** una vez: le pone ID fijo a cada tarea
   existente según su área. Re-correrla es seguro.

---

## Paso 4 — Desplegar como aplicación web

1. **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. **Ejecutar como:** *Yo* (tu cuenta — así lee las hojas privadas).
4. **Quién tiene acceso:** *Cualquier usuario* (el login lo controla la lista,
   no Google).
5. **Implementar** → autoriza los permisos que pida.
6. Copia la **URL del Web App** (termina en `/exec`). **Esa** es la dirección
   que compartirás para entrar con login.

---

## Paso 5 — Avísame

Pásame:
- la **URL del Web App** (`…/exec`), y
- confírmame que ya creaste la hoja **Usuarios**.

Con eso **conecto el login en la página** (la pantalla de usuario/contraseña y
que cargue los datos desde el servidor). Eso es un cambio en `index.html` que
hago yo; lo dejo listo y tú solo recargas.

---

## Notas
- **Guardar cambios (validar/archivar) en el Excel:** por ahora la app maneja
  esos avances en pantalla. Si quieres que el validar/archivar (y el botón de
  borrar + correo) escriban de vuelta en la hoja, lo agregamos como segundo
  paso con funciones `guardar...` en este mismo `Codigo.gs`.
- **Seguridad de contraseñas:** empezar con texto en una hoja privada es lo
  práctico; cuando quieras, lo movemos a contraseñas cifradas (hash).
