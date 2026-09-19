# APP JAIME — ESTADO Y CONTINUIDAD

Este archivo existe para que el proyecto pueda continuar con seguridad aunque una conversación de ChatGPT llegue a su límite de longitud.

## Regla de continuidad
Antes de modificar la app en un chat nuevo:
1. Leer este archivo.
2. Revisar la rama `main` de GitHub y confirmar el script activo desde `index.html`.
3. Revisar únicamente los módulos necesarios para el cambio solicitado.
4. No asumir que una versión mencionada en un chat viejo sigue siendo la última.
5. No modificar Supabase si el cambio es solamente visual.
6. Antes de publicar, comprobar que el commit parte del HEAD actual para no pisar cambios de otros chats.
7. Después de un cambio funcional importante, actualizar este archivo con el nuevo estado.

## Protección de datos — PRIORIDAD MÁXIMA
Nunca borrar, reiniciar ni sustituir datos acumulados salvo instrucción explícita y específica del usuario.
Preservar especialmente:
- alumnos
- pagos y abonos
- anulaciones legítimas
- solicitudes y entregas de libros
- pagos a editorial
- PIN
- asistencia
- actividades/calificaciones
- datos locales del control de efectivo del iPad

No recomendar borrar caché/datos de la PWA como solución rutinaria.

## Arquitectura actual
- Repositorio: `auladelprofejaime/profe-jaime-asistencia`
- Rama de producción: `main`
- Supabase: proyecto `xqeyyjakmeiaahecfdmc`
- La App Docente es una PWA usada principalmente en iPad.
- El número de versión debe actualizarse junto con el script activo y el caché del service worker cuando corresponda.

## Libros — reglas vigentes
- Precio a familias: $280.
- Costo editorial: $250.
- Margen nominal: $30 por libro liquidado.
- Pagos de familias se registran en `book_payment_movements`.
- Las transferencias no son un ledger separado: forman parte del mismo registro canónico de pagos.
- Una anulación corrige el estado/saldo del alumno, pero no debe alterar automáticamente el conteo físico de efectivo que el profesor ya tiene.
- El control físico de efectivo del iPad toma como base el último conteo guardado y se actualiza con cobros/cambio posteriores.
- Administración editorial muestra pagos, saldo de pedidos, próximo pedido, ganancia y proyección total.
- Compra externa: un alumno marcado `external` queda fuera de cobro y fuera de lo que se solicita/paga a editorial.
- FATIMA DHAMAR GARCIA, grupo 23, No. 13, ID 23013, está marcada como compra externa.
- Una alumna en casa hogar podría recibir un libro cubierto por el profesor al costo editorial de $250; NO marcar todavía de forma especial hasta que el usuario confirme que finalmente lo cubrirá.

## Flujo rápido de cobro
- Escanear gafete o escribir ID + Buscar debe abrir el mismo popup unificado.
- No usar un bloque separado de “Registrar abono”.
- El popup muestra pagado/restante.
- En efectivo: monto -> denominaciones recibidas -> cambio -> denominaciones entregadas -> registrar.
- No permitir finalizar si el registro de efectivo no cuadra.
- Transferencia oculta la calculadora de efectivo.
- El flujo debe ser muy rápido porque pueden formarse varios alumnos en pocos minutos.

## Diseño pendiente solicitado
En “Estado por alumno” de Pagos de libros:
- Dar apariencia clara de tabla/listado estructurado.
- Agregar separadores visibles entre alumnos.
- Hacer claro a qué alumno corresponde cada botón de acción.
- Fondo muy tenue por estado, sin perder legibilidad:
  - Pago en proceso: amarillo tenue.
  - Liquidado: verde tenue.
  - Libro solicitado: azul tenue.
  - Libro entregado: mantener estado claramente distinguible.
  - Compra externa: estado neutral/específico sin tratarlo como adeudo.
- Aplicar una lógica visual equivalente en el PDF de reportes de libros, con rellenos suaves por fila.
- Este cambio es PRESENTACIÓN: no debe modificar datos de Supabase.

## Procedimiento recomendado al cambiar de chat
El usuario NO necesita abrir un chat por cada movimiento.
Puede trabajar por bloques grandes. Si ChatGPT muestra “Esta conversación es demasiado larga para continuar”, abrir un chat nuevo dentro del proyecto App Jaime y decir:
“Continúa App Jaime. Lee APP_JAIME_ESTADO_ACTUAL.md y verifica main antes de tocar nada.”

Ese chat debe recuperar el estado real desde GitHub/Supabase en lugar de depender de recordar cada mensaje histórico.

## Última comprobación de continuidad
Archivo creado el 2026-09-19 para evitar dependencia de una sola conversación extensa.
Al crear este archivo, el HEAD observado de `main` fue:
`d8442057bc8cc237d853c9e37d6634f79969291c`


## Mérito Gabino A. Palma — revisión de arranque 2026-09-19
- App Docente actualizada a v8.23.14 para Mérito.
- La clasificación es ÚNICA a nivel escuela: los 18 grupos (11–16, 21–26, 31–36) compiten juntos.
- Se eliminaron los filtros de clasificación por 1.º, 2.º y 3.º tanto de “Clasificación actual” como de “Acumulado anual”.
- El portal público de Mérito quedó en v1.5 y también muestra una sola clasificación general, sin filtros por grado.
- El selector “grado y grupo” del portal de docentes se conserva únicamente como mecanismo rápido para elegir el grupo al registrar un movimiento; no crea rankings separados.
- Backend confirmado: ranking actual, publicación semanal, cierre mensual y acumulado anual usan ranking general de todos los grupos.
- Corregida la función `teacher_merit_ranking`: el conteo de reconocimientos ahora cuenta solo movimientos válidos del grupo y periodo correspondientes.
- No se borraron ni reiniciaron datos.
- Estado al revisar: 18 grupos activos; 0 movimientos; 0 reconocimientos; 0 publicaciones semanales; 0 cierres mensuales.
- Periodo configurado: “Octubre 2026”, 2026-10-01 a 2026-10-23, estado open. Antes del 1 de octubre el registro de movimientos debe responder `no_open_period` por estar fuera de fechas.


## Mérito Gabino A. Palma — preparación Consejo Técnico 2026-09-25
- Creado periodo de prueba separado: “Prueba Consejo Técnico · 25 septiembre 2026”, activo únicamente el 2026-09-25.
- El periodo oficial “Octubre 2026” permanece intacto del 2026-10-01 al 2026-10-23.
- App Mérito Docentes reforzada a v1.3:
  - comprobación visible del estado del sistema;
  - muestra “Sistema listo para registrar” cuando hay periodo activo;
  - informa cuando el periodo aún no inicia;
  - timeout de red y mensajes de conexión comprensibles;
  - caché actualizado para evitar versión vieja.
- Añadida RPC pública mínima `merit_current_period_status()`, que solo informa si hay periodo activo y sus fechas/etiqueta; no expone datos sensibles.
- Al 2026-09-19, la comprobación devuelve periodo inactivo, como corresponde; el 2026-09-25 deberá detectar el periodo de prueba.
- Actualmente solo hay un integrante de `merit_staff` activo. Para que varios docentes prueben la app con trazabilidad individual, deben agregarse/activarse desde “Docentes autorizados” antes del Consejo.
