# Primer Acto | Cuotas y Asistencia — Guía de publicación

## Estado actual
La aplicación **está construida y probada, pero NO está publicada**. Para usarla en tu iPhone necesitas ponerla en internet (paso 1) y luego instalarla (paso 2). Es gratis.

## 1. Publicar (elige UNA opción)

### Opción A — Netlify Drop (la más fácil, sin instalar nada)
1. Descomprime `primer-acto-app.zip` en tu computador. Quedará una carpeta con `index.html`, `logic.js`, etc.
2. Entra a https://app.netlify.com/drop (crea una cuenta gratuita si te la pide).
3. Arrastra **la carpeta completa** a la zona que dice "Drag and drop your site folder here".
4. Netlify te entrega una dirección tipo `https://nombre-aleatorio.netlify.app`. Esa es tu app. Anótala.
5. (Opcional) En "Site configuration → Change site name" puedes poner `primeracto-cuotas`.

### Opción B — GitHub Pages
1. Crea una cuenta en github.com y un repositorio nuevo llamado `primer-acto`.
2. Sube todos los archivos de la carpeta (Add file → Upload files).
3. Settings → Pages → Source: "Deploy from a branch" → rama `main`, carpeta `/ (root)` → Save.
4. En 1–2 minutos queda en `https://TU-USUARIO.github.io/primer-acto/`.

> Importante: la dirección debe ser **https** (las dos opciones lo son). Sin https el iPhone no la instala como app.

## 2. Abrir en el iPhone e instalar
1. Abre **Safari** (debe ser Safari, no Chrome) y escribe la dirección de tu app.
2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba, abajo en el centro).
3. Desliza y toca **"Añadir a pantalla de inicio"**.
4. Deja el nombre "Primer Acto" y toca **Añadir**.
5. Abre la app desde el ícono nuevo. Se ve a pantalla completa, como una app normal.

## 3. Primer uso
1. **Integrantes → ＋**: agrega a cada participante (o usa "Importar nómina (CSV)": columnas Nombre; Apellido; Activo; Fecha de incorporación).
2. En cada persona, la "fecha de incorporación" define desde cuándo se le cobra. No se generan deudas anteriores.
3. **Sesión**: elige la fecha, marca Pagó / Debe / Ausente con un toque. Se guarda solo.
4. **Pagos**: para registrar abonos a deudas anteriores (parciales o totales).
5. **Configuración**: cuota semanal, lugar, día y hora habituales.

## 4. Cómo se guardan los datos (léelo)
- Los datos se guardan **dentro de tu iPhone** (almacenamiento local de la app). Se conservan al cerrar la app, apagar el teléfono y al actualizar la app.
- **Se pierden** si: borras los datos de Safari, eliminas el ícono de la app, o cambias de teléfono sin restaurar un respaldo.
- Por eso: **Configuración → Descargar respaldo completo (.json)** una vez por semana y guárdalo en Archivos/iCloud o envíatelo por correo. La app te recuerda si pasaron 7+ días con cambios sin respaldar.
- Para pasar los datos a otro teléfono: descarga el respaldo y, en el otro, usa "Restaurar desde respaldo".
- No hay cuenta ni nube: nadie más tiene acceso a la información. Tampoco se sincroniza sola entre dispositivos (ver más abajo).

## 5. Actualizar la app más adelante
Se vuelven a subir los archivos nuevos a Netlify/GitHub. Los datos NO se borran porque viven en el teléfono, no en los archivos. Si se cambian archivos, subir el número de `CACHE` en `sw.js` para que el iPhone cargue la versión nueva.

## 6. Sincronización entre dispositivos (opcional, futuro)
No está incluida. Requeriría una base de datos en la nube (por ejemplo Supabase, gratuita) con inicio de sesión. Si la necesitas, se agrega como segunda etapa.
