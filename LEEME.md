# Primer Acto | Cuotas y Asistencia — guía de publicación

## Novedades v1.1
- **Pagos de varias cuotas:** toca "Cobrar" o el nombre de la persona, escribe cuánto pagó (ej. $2.000) y listo. Salda primero las deudas más antiguas y lo que sobre queda como **saldo a favor**.
- **Pago adelantado:** se puede registrar aunque la persona no deba nada. En las sesiones siguientes, el botón del medio dice **"Usa saldo"** y la cuota queda cubierta sola.
- Hoja de pago con botones de monto (1, 2, 3, 4, 8 sesiones, "toda la deuda"), +/− y una vista previa de cómo quedará la cuenta.
- Inicio: lista "Quién debe" con botón Cobrar. Control semanal: buscador y botón "Listo" sin confirmaciones.
- Para actualizar: sube estos archivos al repositorio reemplazando los anteriores. Tus datos NO se borran.


La app es un sitio web estático (sin servidor, sin cuentas, sin costo). Hay que subir esta carpeta a un hosting con HTTPS y abrirlo desde Safari.

## Opción A (la más simple): Netlify Drop
1. Descomprime `primer-acto.zip` en tu computador. Quedará la carpeta `primer-acto` (con `index.html` adentro).
2. Entra a https://app.netlify.com/drop (puedes crear una cuenta gratis con tu correo).
3. Arrastra la carpeta `primer-acto` completa a la página. En segundos te entrega una dirección tipo `https://nombre-aleatorio.netlify.app`.
4. Anota esa dirección. Para actualizar la app en el futuro, vuelve a arrastrar la carpeta en la misma página del sitio ("Deploys"). Los datos de tu teléfono no se borran.

## Opción B: GitHub Pages
1. Crea una cuenta en github.com y un repositorio nuevo (público) llamado `primer-acto`.
2. Sube todos los archivos de la carpeta (botón "Add file → Upload files").
3. Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `(root)` → Save.
4. Tu dirección será `https://TU-USUARIO.github.io/primer-acto/`.

## Abrirla en tu iPhone y agregarla a la pantalla de inicio
1. Abre la dirección en **Safari** (no en Chrome ni dentro de WhatsApp).
2. Toca el botón **Compartir** (cuadrado con flecha hacia arriba).
3. Baja y toca **Agregar a pantalla de inicio** → **Agregar**.
4. **Abre la app desde el ícono nuevo** y empieza a registrar desde ahí.

> IMPORTANTE: en iPhone, la app instalada y Safari guardan los datos por separado. Instala primero y carga integrantes y sesiones sólo desde el ícono. Si ingresaste datos en Safari antes de instalar, usa Configuración → "Respaldo completo (.json)" y luego "Restaurar respaldo" en la app instalada.

## Dónde se guardan los datos y sus límites
- Se guardan **en tu teléfono** (almacenamiento local del navegador). Sobreviven al cierre de la app, al apagado y a las actualizaciones de la app.
- Se pierden si: borras los datos del sitio en Ajustes de Safari, desinstalas la app, o cambias de teléfono sin respaldo.
- No se sincronizan con otro dispositivo: cada teléfono tiene su propia información.
- **Respaldo:** Configuración → "Respaldo completo (.json)". Guárdalo en Archivos/iCloud o envíalo a tu correo. Haz uno al menos una vez al mes (o tras cada sesión importante). La app además guarda una copia interna diaria.
- Para reportes y nómina en Excel: botones "Exportar" (CSV, se abre directo en Excel). Para importar nómina desde Excel, guárdala como CSV (Nombre; Apellido).
- La app sólo guarda nombre y apellido. No pide datos personales adicionales.

## Sincronizar entre dispositivos (no incluido en esta versión)
Requeriría una base de datos en la nube con inicio de sesión (por ejemplo Supabase, con cuenta gratuita). No está activado: hoy el respaldo manual es el mecanismo de recuperación. Se puede agregar como segunda etapa.

## Pruebas automáticas
`node tests/test-escenarios.js` verifica los 8 escenarios de cálculo y persistencia (requiere Node.js).
