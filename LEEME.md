# Agenda y apuntes — prototipo offline 1.0

Dos funciones: organizar tareas y escribir apuntes. Los datos se guardan en el dispositivo. La app puede volver a abrirse sin internet después de prepararse desde el alojamiento web.

**Estado:** código terminado y pruebas automatizadas ejecutadas. No está desplegado en tu alojamiento. La validación visual y en Android, iPhone y computadora reales queda pendiente: no se tuvo acceso a esos dispositivos ni a un navegador de prueba en esta sesión.

## Qué incluye

- Agenda: crear, editar, completar y eliminar tareas; fecha, hora, curso, prioridad y detalles; filtros por día, semana o tareas sin fecha; búsqueda.
- Apuntes: editor de texto, guardado automático, búsqueda, curso o tema, fijar favoritos y descargar como `.txt`.
- Copias de todos los datos en JSON, con importación validada que añade lo que falte y conserva los registros existentes.
- Modo claro y oscuro, diseño adaptable a teléfonos y escritorio, instalación como aplicación web y funcionamiento offline tras la primera carga completa.

No incorpora IA, pagos, cuentas, adjuntos, sincronización, notificaciones ni alarmas. La hora de una tarea solo organiza su posición en la agenda.

## Añadirlo al alojamiento actual

Si tu proyecto usa `server.js` y una carpeta `public/`:

1. Descomprime este paquete.
2. Copia **únicamente la carpeta `public/agenda-offline/`** dentro de la carpeta `public/` de tu proyecto. El resultado será `tu-proyecto/public/agenda-offline/index.html`.
3. Conserva los archivos `server.js` y `package.json` que ya tiene tu aplicación. Los incluidos aquí sirven solo para la prueba local de este prototipo.
4. Despliega el proyecto en **el mismo alojamiento de siempre**.
5. Abre `https://TU-DOMINIO/agenda-offline/` en un navegador normal. Usa la barra final `/`.
6. Espera a que aparezca **«Lista sin conexión»**. Después instala o añade la app a la pantalla de inicio, ábrela allí con internet y comprueba otra vez ese estado.

No se necesitan claves API, una base de datos nueva ni licencias de pago. El coste de licencias del prototipo es **$0**; utiliza tu alojamiento existente.

Si el alojamiento publica directamente archivos estáticos, sube la carpeta `agenda-offline/` al directorio público. El nombre de la carpeta puede cambiar, pero conviene decidir la ruta final antes de empezar: el almacenamiento se separa por origen y ruta.

### Si tu servidor no publica automáticamente esa carpeta

En Express, la carpeta estática debe exponerse **antes de cualquier ruta comodín o redirección de la app**. Un proyecto que ya sirva `public/` normalmente no necesita cambios. Si necesitas un montaje explícito, esta es la forma para un servidor CommonJS con `express` y `path` ya importados:

```js
app.use('/agenda-offline', express.static(
  path.join(__dirname, 'public', 'agenda-offline'),
  { etag: true, maxAge: 0 }
));
```

Este fragmento es una guía de integración; no se ha insertado en ningún servidor existente. Mantén la ruta accesible sin una sesión online si quieres que las siguientes aperturas sean offline. Si ya existe una política CSP estricta, permite los archivos locales y `worker-src 'self'` en esta ruta.

Comprueba que `sw.js` devuelva JavaScript y que `manifest.webmanifest` devuelva JSON de manifiesto, no la página principal de tu otra aplicación. HTTPS es necesario fuera de `localhost`.

## Probar primero en computadora

Con Node.js 18 o superior instalado, no hace falta instalar paquetes:

```sh
node dev-server.cjs
```

En Windows también puedes hacer doble clic en `INICIAR_WINDOWS.cmd`. Abre la dirección que aparece en la consola: `http://localhost:8080/agenda-offline/`. Para usar otro puerto, define `AGENDA_PORT`.

El servidor de prueba solo escucha en la propia computadora. Para probar en Android e iPhone usa el alojamiento HTTPS existente. Abrir `index.html` como archivo o una dirección HTTP de la red local no prepara el modo offline.

## Guardado y copias

El editor guarda poco después de dejar de escribir (400 ms) y muestra «Guardado en este dispositivo» cuando la transacción termina. Espera ese mensaje antes de cerrar la app; también tienes «Guardar ahora». Si el almacenamiento falla, verás un error: no se confirma un guardado que no terminó.

Exporta desde **Copias → Exportar copia**. Revisa que el archivo se haya guardado en Descargas o Archivos. La copia contiene texto sin cifrar. Para pasar tus datos a otro dispositivo, importa allí el JSON. Si un identificador ya existe, se conserva la versión de ese dispositivo; esta importación no combina ediciones ni sustituye registros.

Cada navegador, perfil, dispositivo y origen mantiene sus propios datos. No hay sincronización automática. La app instalada y el navegador pueden usar almacenes separados; verifica o importa la copia en la app desde la que vayas a trabajar. No uses modo privado ni borres los datos del sitio sin una copia: los navegadores también pueden liberar almacenamiento. Solicitar almacenamiento persistente ayuda cuando el navegador lo concede, pero no sustituye una copia.

Límites del prototipo: 5.000 tareas y 5.000 apuntes, 100.000 caracteres por apunte y 10 MB por archivo importado. El espacio real disponible depende del navegador. Para evitar ediciones concurrentes, usa una sola pestaña de este prototipo a la vez.

## Validación antes de ampliar funciones

Consulta `PRUEBAS_EN_DISPOSITIVOS.md`. Haz las mismas comprobaciones en Android, iPhone y computadora. No des por cerrada esta fase hasta comprobar la apertura en modo avión, la persistencia tras cerrar y volver a abrir, y la exportación/importación.

El plan de 1–2 días corresponde a implementación y validación; la implementación está entregada. Las pruebas reales siguen pendientes.

## Pruebas automatizadas y estructura

```sh
node --test tests/*.test.cjs
```

`RESULTADO_PRUEBAS.md` explica exactamente qué se comprobó y qué no. Las pruebas del service worker y de IndexedDB usan dobles controlados en Node: comprueban lógica, pero no sustituyen a Safari, Chrome ni hardware real.

```text
public/agenda-offline/  → archivos que se añaden al alojamiento
dev-server.cjs         → servidor para una prueba local de escritorio
INICIAR_WINDOWS.cmd   → acceso rápido a ese servidor
tests/                → pruebas automáticas sin dependencias
```

El service worker solo interviene sobre archivos conocidos de su propia carpeta. No intercepta APIs ni otras secciones, y su limpieza de caché no borra cachés de otras aplicaciones. Una actualización espera a que se cierren las pestañas de la versión anterior. Para futuras versiones, cambia el identificador de caché en `sw.js` junto con los archivos de la aplicación.

## Documentación consultada

- [MDN: uso de service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) — primera carga, caché, HTTPS y ciclo de actualización.
- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — almacenamiento estructurado y transacciones.
- [Apple: convertir una web en app en iPhone](https://support.apple.com/es-es/guide/iphone/iphea86e5236/ios) — añadir a la pantalla de inicio desde Safari.

Consultado el 11 de octubre de 2026, hora de Lima.
