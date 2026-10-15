# Prueba de aceptación — Agenda y apuntes

**Estado inicial: todas las pruebas en dispositivos están pendientes.** Este documento es una guía para ejecutarlas, no un registro de pruebas realizadas. No se ha usado un emulador ni se han simulado dispositivos como si fueran pruebas reales.

Usa la misma URL HTTPS y la misma versión del prototipo en los tres equipos. Reserva unos 15–20 minutos por equipo. No introduzcas apuntes importantes antes de terminar la comprobación de copias.

| Equipo | Navegador / sistema y versión | Fecha de prueba | Resultado |
|---|---|---|---|
| Android | Por completar, Chrome | — | Pendiente |
| iPhone | Por completar, Safari | — | Pendiente |
| Computadora | Por completar, Chrome o Edge; Safari si se utiliza | — | Pendiente |

## 1. Primera carga e instalación

1. Abre `https://TU-DOMINIO/agenda-offline/` con internet, fuera del modo privado.
2. Verifica que aparezcan Agenda, Apuntes y Copias sin texto cortado ni desplazamiento horizontal.
3. Espera **«Lista sin conexión»**. Si no aparece, abre Copias y lee el motivo.
4. En Android, usa el menú de Chrome para instalar o añadir a inicio. En iPhone, abre Compartir en Safari y añade a la pantalla de inicio. En computadora, puedes instalarla desde Chrome/Edge o utilizar una pestaña.
5. Abre la app instalada **con internet** y vuelve a esperar el estado offline. No supongas que el estado del navegador es el mismo que el de la app instalada.

**Esperado:** la app abre correctamente y confirma que está preparada para trabajar sin conexión.

## 2. Crear y editar

1. Crea «Prueba de agenda», para hoy, a una hora cualquiera, prioridad alta, curso «Pruebas» y un detalle.
2. Crea una segunda tarea sin fecha. Busca ambas por el título y por el curso.
3. Cambia entre los filtros Día, Semana, Todas y Sin fecha.
4. Marca la primera como hecha. Activa «Ver hechas» y vuelve a marcarla como pendiente.
5. Edita fecha y título de la segunda tarea. Comprueba el resultado al cerrar y reabrir el formulario.
6. Crea «Apunte de prueba» con tildes, un emoji y varias líneas: `Física, acción, mañana 📝`.
7. Cambia el curso, fija el apunte y espera **«Guardado en este dispositivo»**.
8. Descarga el apunte como texto y verifica que conserva caracteres y saltos de línea.

**Esperado:** los cambios se mantienen, los filtros responden y el mensaje de guardado aparece después de cada edición.

## 3. Abrir y editar sin red — prueba decisiva

1. Espera a que no haya cambios pendientes y a que indique «Lista sin conexión».
2. Activa modo avión y comprueba que **Wi‑Fi también esté apagado**. En computadora, desactiva la red o usa el modo offline del navegador.
3. Cierra la app o pestaña. Ábrela de nuevo desde el icono o la URL exacta. Si utilizas el servidor local de escritorio, mantenlo iniciado para una prueba normal y deténlo para comprobar que la caché puede responder sin él.
4. Verifica que reaparezcan las tareas y el apunte.
5. Crea «Creada sin internet», edita el apunte añadiendo `Edición offline`, completa otra tarea y espera el guardado.
6. Vuelve a cerrar y abrir sin conexión. Comprueba todos esos cambios.
7. Recupera internet. Comprueba que el contenido permanezca intacto.

**Esperado:** la app abre y guarda sin red, incluso tras cerrarla y volver a abrirla. Un fallo en cualquiera de esos puntos impide aprobar el prototipo.

## 4. Copias y recuperación

1. Exporta una copia JSON desde Copias. Localiza el archivo en Descargas o Archivos.
2. Transfiérelo a otro equipo o a otro perfil de navegador normal. Abre allí la app e importa la copia.
3. Verifica títulos, detalles, fechas, horas, prioridades, tareas completadas y contenido de los apuntes.
4. Importa la misma copia otra vez. Confirma que **no se duplican registros**.
5. Edita un apunte en el dispositivo de destino. Importa otra vez la copia antigua: debe conservar la edición local, porque no se sobrescriben identificadores existentes.
6. Intenta importar un archivo JSON ajeno o inválido. Debe aparecer un error y conservarse todo el contenido actual.

**Esperado:** una copia válida permite recuperar información en un almacén vacío; una copia inválida no modifica los datos; las importaciones repetidas no duplican registros.

## 5. Interacción y pantalla

1. En teléfonos, prueba vertical y horizontal. Abre el teclado y edita una nota larga; el botón Guardar ahora debe seguir siendo alcanzable al desplazarte.
2. Comprueba los botones de navegación inferior, el regreso al cuaderno y el cierre de formularios.
3. Alterna modo claro y oscuro. Cierra y abre: debe recordar la elección.
4. En computadora, navega con Tab y Enter; usa Escape para cerrar los diálogos.
5. Amplía el navegador al 200 % y verifica que controles y contenido sigan siendo utilizables.
6. Elimina solo las tareas y apuntes de prueba, confirmando la acción. Cancela una eliminación y comprueba que se conserve el contenido.

## Registro

| Comprobación | Android | iPhone | Computadora |
|---|---|---|---|
| Primera carga / instalación | Pendiente | Pendiente | Pendiente |
| CRUD de tareas | Pendiente | Pendiente | Pendiente |
| Edición y guardado de apuntes | Pendiente | Pendiente | Pendiente |
| Apertura sin red tras cerrar | Pendiente | Pendiente | Pendiente |
| Persistencia tras editar offline | Pendiente | Pendiente | Pendiente |
| Exportación e importación | Pendiente | Pendiente | Pendiente |
| Teclado, rotación y navegación | Pendiente | Pendiente | Pendiente |

Anota cada problema con equipo, versión, pasos exactos, resultado esperado y resultado observado. Añade captura si ayuda. Amplía funciones solo cuando todos los puntos críticos anteriores estén aprobados en los tres tipos de equipo.
