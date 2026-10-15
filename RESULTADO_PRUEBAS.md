# Resultado de verificación

Versión: 1.0.0. Sesión de trabajo: 11 de octubre de 2026, hora de Lima.

## Resultado automatizado

**21 pruebas aprobadas, 0 fallos.** Ejecutadas con `node --test tests/*.test.cjs` en el entorno Linux de desarrollo. También se comprobó la sintaxis de los archivos JavaScript.

| Grupo | Cantidad | Qué se verifica |
|---|---:|---|
| Datos y fechas | 5 | Fechas locales y bisiestas, filtros, búsqueda sin tildes, ordenación, ida y vuelta de copias, rechazo de datos inválidos |
| Caché offline | 5 | Instalación de recursos, reapertura simulada sin red, límites de rutas, aislamiento de cachés y error si faltan archivos |
| Guardado | 6 | Confirmación solo tras commit, propagación de errores, importación sin sobrescritura, eliminación, lectura y almacenamiento no disponible |
| Paquete y servidor local | 5 | Iconos y manifiesto, recursos e IDs, tipos MIME, redirecciones, rutas inválidas y peticiones HEAD |

Las pruebas de caché ejecutan el código real de `sw.js` en un contexto de Node con una implementación controlada de caché y red. Las de almacenamiento ejecutan `storage.js` con un doble del contrato IndexedDB que separa las peticiones de la confirmación de la transacción. El servidor se prueba llamando directamente a su manejador, sin abrir un puerto.

**Estas pruebas no ejecutan navegadores, no emulan Android ni iPhone y no prueban un disco de teléfono real.** No certifican el comportamiento de IndexedDB, Safari, Chrome o la instalación PWA en esos dispositivos. El editor y la interfaz se han revisado por código y estructura, sin inspección visual en navegador.

## Pendiente antes de aprobar el prototipo

| Validación | Estado |
|---|---|
| Integración y despliegue en el alojamiento actual | Pendiente: no se identificó inequívocamente el proyecto de destino |
| Primera instalación desde HTTPS | Pendiente |
| Android: instalación, apertura sin red, persistencia, copias y teclado | Pendiente |
| iPhone: instalación en Safari, apertura sin red, persistencia, copias y teclado | Pendiente |
| Computadora: interacción completa, apertura sin red, persistencia y copias | Pendiente |
| Inspección visual, rotación de pantalla y zoom | Pendiente |

La guía de aceptación está en `PRUEBAS_EN_DISPOSITIVOS.md`. La versión entregada es un prototipo para completar estas comprobaciones antes de ampliar funciones.
