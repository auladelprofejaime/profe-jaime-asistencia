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


## Mérito Gabino A. Palma — folios docentes para Consejo Técnico
- Creados 60 folios alfanuméricos reservados: MGP-D001 a MGP-D060.
- Los 60 están inicialmente inactivos, sin nombre y no aparecen como docentes reales hasta ser asignados.
- App Docente actualizada a v8.23.15 con flujo:
  1. Escanear/escribir folio MGP-Dxxx.
  2. Capturar nombre, tipo y asignatura/función.
  3. Activar folio.
  4. Generar automáticamente código personal de 4 dígitos para activar la app Mérito Docentes.
- Los folios no escaneados permanecen inactivos y no requieren borrado posterior.
- Se agregó botón “Imprimir 60 folios” con código de barras Code 39, legible también en texto.
- Los folios activos conservan su staff_code para trazabilidad.
- Verificación posterior: total_folios=60, available_inactive=60, assigned=0.


## Mérito Gabino A. Palma — acceso docente definitivo para prueba 2026-09-25
- Se sustituyeron los folios alfanuméricos MGP-D001…MGP-D060 por IDs exclusivamente numéricos de 6 dígitos: 700001…700060.
- Cada uno de los 60 IDs tiene un NIP inicial único de 4 dígitos.
- Los 60 accesos pueden entrar a la app Mérito Docentes durante septiembre aunque aún no tengan nombre, para la demostración del Consejo Técnico.
- Mérito Docentes v1.4 ahora inicia con ID + NIP, no con un código de activación aislado.
- La hoja imprimible contiene: ID, NIP inicial y código de barras numérico del ID.
- En App Docente v8.23.16, el administrador escanea el ID y captura nombre/tipo/asignatura para confirmar al participante.
- Confirmar a un docente conserva el mismo ID y el mismo NIP inicial, pero marca must_change_pin=true.
- El docente debe cambiar obligatoriamente su NIP antes de seguir registrando movimientos después de ser confirmado.
- Tras el cambio, el NIP inicial se elimina de la credencial imprimible y deja de ser válido.
- Los IDs no confirmados vencen después del 2026-09-30. Desde el 2026-10-01 no pueden iniciar sesión ni registrar movimientos; sus dispositivos quedan revocados al detectarse y el registro se archiva para conservar trazabilidad de la prueba.
- No usar “31 de septiembre”: septiembre termina el día 30.
- Verificación: 60 IDs, 60 NIP iniciales únicos y válidos de 4 dígitos; rango 700001–700060.
- Prueba transaccional de login realizada con 700001: login_ok=true; la transacción fue revertida para no dejar un dispositivo de prueba.


## Mérito Gabino A. Palma — activación simplificada por ID
- Flujo definitivo para participantes del Consejo Técnico:
  1. El docente recibe hoja con ID numérico + NIP inicial.
  2. Puede probar la app durante septiembre con esas credenciales.
  3. Si acepta participar, el administrador escanea únicamente el ID desde App Docente.
  4. El administrador pulsa “Activar participación”; NO captura nombre ni asignatura.
  5. El ID queda marcado para completar registro y must_change_pin=true.
  6. En la app Mérito Docentes, el participante debe capturar obligatoriamente:
     - Nombre
     - Primer apellido
     - Asignatura
     - NIP actual
     - Nuevo NIP
     - Confirmación del nuevo NIP
  7. Hasta completar esos datos y cambiar el NIP, no puede registrar movimientos.
  8. Al completar el registro, display_name se forma con Nombre + primer apellido, se guarda asignatura, se elimina el NIP inicial y el nuevo NIP queda vigente.
- App Docente: v8.23.17.
- Mérito Docentes: v1.5.
- Los accesos no activados siguen venciendo después del 2026-09-30.


## Mérito Gabino A. Palma — recuperación individual de NIP y modo offline
- App Docente: v8.23.18.
- Mérito Docentes: v1.6.
- Recuperación de acceso:
  - En la matriz de docentes confirmados, cada docente con ID tiene botón individual “Generar NIP temporal”.
  - El restablecimiento afecta únicamente a ese docente.
  - Conserva nombre, asignatura, ID e historial.
  - Revoca únicamente sus dispositivos activos.
  - Genera un NIP temporal de 4 dígitos mostrado al administrador.
  - Al volver a ingresar con ID + NIP temporal, el docente solo cambia su NIP; NO vuelve a capturar nombre/apellido/asignatura.
  - Se retiró visualmente el flujo legado “Generar código” del listado de Mérito.
- Alta inicial:
  - El administrador sigue haciendo únicamente escanear ID -> Activar participación.
  - Un ID se considera ocupado desde confirmed_at, aunque el docente todavía no complete su perfil.
  - El primer registro del docente sí solicita nombre, primer apellido, asignatura y cambio de NIP.
- Offline:
  - Una vez que el dispositivo ya tuvo un acceso válido y conserva token/sesión local, puede capturar movimientos sin internet.
  - Los movimientos offline se guardan en una cola local del dispositivo.
  - Cada movimiento lleva client_event_id único para evitar duplicados y captured_at para conservar la fecha/hora real de captura.
  - Al recuperar internet, la app sincroniza automáticamente; también tiene botón manual “Sincronizar”.
  - La pantalla muestra estado: sin internet, pendientes, sincronizando o todo sincronizado.
  - El servidor acepta sincronización tardía con una ventana máxima de 72 horas y asigna el movimiento al periodo correspondiente a captured_at.
  - Los límites diarios se calculan con captured_at, no con la hora posterior de sincronización.
  - Primer acceso, recuperación de NIP y cambio de NIP requieren internet; no se almacenan NIP nuevos en cola offline.
  - Si una sesión fue revocada mientras el dispositivo estaba sin conexión, una captura local puede quedar pendiente, pero el servidor no la publicará hasta que vuelva a existir autorización válida.
- Base:
  - merit_movements incorpora client_event_id y captured_at.
  - Índice único parcial sobre client_event_id.
  - teacher_merit_reset_staff_pin(uuid) realiza recuperación individual.
  - merit_register_movement admite client_event_id y captured_at.
- Corrección adicional: se eliminó un error de sintaxis previo “async async function” en la impresión de hojas de acceso.


## Mérito Gabino A. Palma — branding Aula del Profe Jaime
- Aplicado branding de autoría en todas las superficies principales de Mérito:
  - App Mérito Docentes
  - Portal público de Mérito
  - Módulo Mérito dentro de App Docente
  - Hojas imprimibles de acceso docente
- Encabezado/subfirma acordada:
  - “Una app de Aula del Profe Jaime”
- Pie/firma acordada:
  - “Aula del Profe Jaime · Creado por Profesor Jaime Armando”
- La identidad principal sigue siendo “Mérito Gabino A. Palma”; Aula del Profe Jaime se presenta como autoría/desarrollo.
- En las hojas imprimibles se usa el logo de Mérito Gabino A. Palma, no el logo de App Docente.
- Las hojas también incluyen la firma Aula del Profe Jaime en el pie.
- App Docente actualizada a v8.23.19.
- Cachés actualizados: App Docente v8.23.19, Mérito Docentes v1.7, Mérito Público v1.6.


## Mérito Gabino A. Palma — PDF de accesos docentes v8.23.20
- El generador de accesos docentes ahora crea un PDF real tamaño carta, no una ventana de impresión HTML.
- Distribución: 2 usuarios por hoja carta vertical; cada credencial ocupa media carta horizontal para cortar la hoja a la mitad.
- Incluye línea de corte al centro.
- Conserva diseño de Mérito Gabino A. Palma, logo de Mérito y branding Aula del Profe Jaime.
- Se agregó visor interno de PDF dentro de App Docente con botones:
  - Compartir PDF
  - Descargar PDF
  - Cerrar
- Cerrar regresa al módulo de Mérito sin cerrar/reiniciar la app.
- Compartir usa Web Share con archivo PDF cuando el dispositivo lo permite; si no, descarga el PDF como alternativa.
- Nombre de archivo: Merito_Gabino_A_Palma_Accesos_Docentes.pdf
- Para 60 accesos, el PDF genera 30 páginas.
- App Docente actualizada a v8.23.20 y caché app-docente-v8-23-20.


## Mérito Gabino A. Palma — barcode compacto y periodos visibles v8.23.21
- App Docente actualizada a v8.23.21.
- PDF de accesos docentes:
  - Código de barras reducido para escáner pequeño tipo tienda.
  - Nuevo tamaño aproximado en PDF: 230 pt de ancho × 30 pt de alto.
  - Se conserva ID visible debajo.
  - Se mantiene hoja carta con 2 credenciales horizontales por página.
- Periodos:
  - Confirmado en base que existen y siguen intactos:
    - Prueba Consejo Técnico · 25 septiembre 2026 (2026-09-25 a 2026-09-25, open)
    - Octubre 2026 (2026-10-01 a 2026-10-23, open)
  - El problema era de carga/visualización cuando la sesión de profesor aún no estaba restaurada.
  - Nuevo módulo merit-period-fix-v82321.js reintenta automáticamente la carga tras restaurar sesión.
  - Reintenta a 700 ms, 1800 ms y 3500 ms, al volver a enfocar la app y al entrar a cualquier pestaña de Mérito.
  - Si detecta “sesión requerida / no autorizado”, muestra “Conectando con la sesión del profesor…” en lugar de dejar “sin periodos”.
- Caché App Docente actualizado a app-docente-v8-23-21.


## Mérito Gabino A. Palma — rango definitivo de IDs de personal v8.23.22
- El ID 700001 queda reservado y asignado al registro activo de Jaime Armando Perez Vazquez.
- Los accesos disponibles para demás personal son 700002–700070.
- Total de accesos reservados para personal adicional: 69.
- Los 60 placeholders originales fueron recorridos conservando sus filas y NIP:
  - antes: 700001–700060
  - ahora: 700002–700061
- Se crearon 9 accesos adicionales: 700062–700070.
- Los 69 accesos 700002–700070 tienen NIP inicial válido de 4 dígitos y los 69 NIP son únicos.
- 700001 no se incluye en el PDF de accesos disponibles.
- El PDF / botón de App Docente ahora muestra 69 accesos.
- Scanner/ejemplo actualizado al rango 700002…700070.
- App Docente actualizada a v8.23.22; caché app-docente-v8-23-22.
- Verificación de seguridad de Supabase posterior: 0 avisos devueltos por advisor.


## Mérito Docentes — recordar sesión
- En el inicio de sesión de Mérito Docentes se agregó la casilla:
  - “Recordar mi sesión en este dispositivo”
- Viene activada por defecto.
- Si está activada:
  - se conserva el token de sesión autorizado en almacenamiento persistente del dispositivo;
  - el docente no necesita volver a escribir ID + NIP cada vez que abre la app.
- Si está desactivada:
  - la sesión se guarda solo para la sesión actual del navegador/app;
  - al cerrar esa sesión deberá volver a iniciar con ID + NIP.
- El NIP NO se guarda en almacenamiento local ni de sesión.
- “Desvincular” elimina tanto la sesión persistente como la temporal.
- Mérito Docentes usa app.js?v=17 y caché merito-docentes-v1-8.


## Mérito Gabino A. Palma — votación de desempate
- Se implementó votación formal para empates del cierre mensual.
- Flujo:
  1. En App Docente, al pulsar “Cerrar mes”, se ejecuta la vista previa.
  2. Si no hay empates, el cierre continúa normalmente.
  3. Si existe uno o varios empates, el periodo pasa a frozen / results_in_process y se abre automáticamente una sesión de votación.
  4. Solo se incluyen como votantes quienes están activos, confirmados, no archivados y con perfil completo.
  5. En Mérito Docentes aparece automáticamente una tarjeta “Votación de desempate”.
  6. Cada integrante puede emitir un solo voto por cada empate; no puede cambiarlo ni duplicarlo desde otro dispositivo.
  7. La app del personal no muestra conteos mientras la votación está abierta.
  8. App Docente sí muestra participación y conteos por candidato.
  9. El administrador puede “Cerrar votación y resolver desempate”.
  10. Si existe un ganador único por votos, se genera automáticamente la resolución y se cierra el mes.
  11. Si la votación permanece empatada, la App Docente solicita al Comité Organizador elegir entre los grupos que continúan empatados y escribir una nota.
  12. La resolución del Comité queda registrada y después se realiza el cierre mensual.
- Backend nuevo:
  - merit_tie_vote_sessions
  - merit_tie_vote_issues
  - merit_tie_vote_candidates
  - merit_tie_vote_eligible
  - merit_tie_vote_ballots
  - teacher_merit_open_tie_vote(uuid)
  - teacher_merit_tie_vote_status(uuid)
  - teacher_merit_close_tie_vote(uuid,jsonb)
  - merit_pending_tie_votes(text)
  - merit_cast_tie_vote(text,uuid,text)
- Las tablas nuevas tienen RLS habilitado y acceso directo revocado a anon/authenticated; la operación se realiza mediante RPC validadas.
- Mérito Docentes:
  - app.js?v=18
  - caché merito-docentes-v1-9
  - consulta votaciones al entrar, al recuperar internet, al volver a primer plano y cada 30 s.
- App Docente:
  - v8.23.23
  - módulo merit-tie-vote-v82323.js?v=82323
  - caché app-docente-v8-23-23
- Verificación:
  - 0 sesiones de votación reales creadas durante implementación.
  - Periodo Prueba Consejo Técnico 25/09/2026 sigue open/public_state open.
  - Periodo Octubre 2026 sigue open/public_state open.
  - RPC de consulta/voto rechazan tokens inválidos con unauthorized.


## Mérito Gabino A. Palma — QR directo en PDF de accesos v8.23.24
- El generador PDF de accesos docentes incorpora automáticamente un código QR en cada credencial.
- El QR dirige directamente a la App Mérito Docentes:
  https://auladelprofejaime.github.io/profe-jaime-asistencia/merito-docentes/
- El QR aparece pequeño, en la zona inferior derecha de cada media carta, con la leyenda “Escanea para ingresar”.
- Se mantiene:
  - hoja tamaño carta vertical
  - 2 accesos horizontales por hoja
  - 69 accesos disponibles (700002–700070)
  - barcode compacto
  - botones Compartir PDF / Descargar PDF / Cerrar
  - branding Mérito Gabino A. Palma + Aula del Profe Jaime.
- App Docente actualizada a v8.23.24; caché app-docente-v8-23-24.


## Mérito Docentes — notificaciones push obligatorias
- Después de completar perfil y cambiar NIP, el docente debe activar notificaciones antes de continuar.
- La pantalla obligatoria dice:
  - “Activa las notificaciones”
  - explica que son necesarias para avisos importantes de Mérito Gabino A. Palma.
- Si el navegador/dispositivo no admite Web Push, la pantalla indica que en iPhone/iPad debe agregarse Mérito Docentes a la pantalla de inicio y abrirse desde ahí.
- No se permite avanzar mientras el permiso/suscripción push no quede activo en ese dispositivo.
- Las suscripciones quedan ligadas al token/dispositivo de Mérito y al registro del personal, no a la cuenta Supabase de App Docente.
- Nueva tabla privada: merit_push_subscriptions (RLS habilitado, acceso directo revocado; se opera mediante RPC validadas).
- RPC:
  - merit_register_push(...)
  - merit_push_status(text)
  - merit_unregister_push(text,text)
- Edge Function nueva: merit-push.
- Solo se procesan dos eventos en el service worker de Mérito Docentes:
  1. merit_vote_open — “Votación de desempate abierta”.
  2. merit_results_published — resultados oficiales: Mérito del Mes + reconocimientos del periodo.
- Al tocar notificación de votación, abre Mérito Docentes.
- Al tocar notificación de resultados, abre Mérito Público.
- App Docente envía merit_vote_open únicamente cuando una votación nueva se abre por empate.
- Al publicar resultado oficial, App Docente envía merit_results_published después de que el periodo queda published/official.
- Mérito Docentes:
  - app.js?v=19
  - caché merito-docentes-v1-10
- App Docente:
  - v8.23.25
  - merit-tie-vote-v82325.js?v=82325
  - caché app-docente-v8-23-25
- Verificación: token inválido en merit_register_push devuelve unauthorized.
- No se generaron suscripciones reales durante la implementación.


## Mérito Docentes — notificación automática de inicio de mes
- Se agregó un tercer tipo de notificación push: merit_period_started.
- Texto:
  - Título: “🔄 Inicia un nuevo mes de Mérito”
  - Mensaje: “Comienza [periodo]. Todos los grupos inician nuevamente desde cero. Ya puedes registrar puntos y reconocimientos del nuevo periodo.”
- Se envía automáticamente el día real de inicio del periodo mensual oficial; no cuando se crea/configura por adelantado.
- Programación:
  - cron job: merit-month-start-notification
  - horario: 12:30 UTC = 06:30 hora de Ciudad de México
  - frecuencia diaria
- El backend solo notifica periodos que:
  - empiezan ese día en America/Mexico_City,
  - están status=open,
  - duran más de un día,
  - y no comienzan con “Prueba”.
- Por lo anterior, “Prueba Consejo Técnico · 25 septiembre 2026” queda excluida.
- Se creó merit_period_push_log para impedir envíos duplicados por periodo.
- Edge Function merit-push actualizada a v2.
- Se corrigieron permisos internos de service_role únicamente para las tablas necesarias del backend de push.
- Prueba real del endpoint el 2026-09-19:
  - HTTP 200
  - date=2026-09-19
  - periods_notified=0
  - sent=0
  - no se generó ningún envío ni registro.
- Mérito Docentes:
  - app.js?v=20
  - service worker caché merito-docentes-v1-11
  - ahora acepta exactamente tres eventos:
    1. merit_period_started
    2. merit_vote_open
    3. merit_results_published
- La pantalla obligatoria de permisos explica ahora los tres tipos de avisos.


## Mérito — revisión mensual de bitácoras
- App Docente v8.23.26 agrega una matriz de revisión mensual de las 18 bitácoras dentro de Cierre mensual.
- Flujo:
  1. Seleccionar periodo mensual.
  2. Revisar físicamente las 18 bitácoras.
  3. Capturar únicamente el número total de observaciones de cada grupo; incluso 0 debe escribirse.
  4. La app calcula automáticamente el descuento.
  5. Guardar revisión.
  6. Solo entonces se permite cerrar el mes / abrir una votación por empate.
- Escala oficial:
  - 0–2 observaciones = 0
  - 3–4 = -2
  - 5–6 = -5
  - 7–9 = -8
  - 10 o más = -10
- La matriz muestra: Grupo, Puntos, Observaciones del mes, Descuento, Final estimado.
- Los descuentos de bitácora NO modifican los cortes semanales anteriores ni la clasificación en vivo; se aplican exclusivamente al resultado mensual final.
- El cierre mensual guarda por grupo:
  - base_score
  - bitacora_observations
  - bitacora_deduction
  - monthly_score final
  - monthly_rank final
- El acumulado anual usa monthly_score, por lo que incorpora automáticamente el ajuste ya aplicado al cierre.
- Nueva tabla: merit_monthly_bitacora_adjustments, con RLS y acceso directo revocado.
- Nuevas RPC admin:
  - teacher_merit_bitacora_matrix(uuid)
  - teacher_merit_save_bitacora_matrix(uuid,jsonb)
- teacher_merit_close_preview y teacher_merit_close_month calculan el puntaje final como puntos base + descuento de bitácora.
- teacher_merit_open_tie_vote no puede abrir votación mientras falte la revisión de bitácoras.
- Los 18 grupos deben quedar capturados para un periodo mensual real.
- Los periodos de prueba de un solo día / con nombre iniciado por “Prueba” quedan exentos.
- Verificado:
  - Prueba Consejo Técnico 25/09/2026 -> bitácora no requerida.
  - Octubre 2026 -> bitácora requerida.
  - escala automática validada para 0,1,2,3,4,5,6,7,8,9,10 y 15 observaciones.
- Frontend:
  - merit-bitacora-v82326.js?v=82326
  - App Docente v8.23.26
  - caché app-docente-v8-23-26


## Correcciones 20/09/2026 — Mérito v8.23.27 / Mérito Docentes v21
- Se detectó y corrigió una falla real en merito-docentes/app.js:
  - la línea de utilidades declaraba dos veces `$` en la misma sentencia;
  - eso generaba SyntaxError y detenía toda la app;
  - por eso el botón “INGRESAR Y ACTIVAR DISPOSITIVO” no respondía.
- Corrección:
  - `const $=... , $$=...`
  - app.js?v=21
  - service-worker.js?v=21
  - caché Mérito Docentes `merito-docentes-v1-12`
  - sintaxis JavaScript verificada correctamente después del cambio.
- El registro 700001 sigue activo y sin alteración de su NIP/datos. El problema era de frontend, no de la cuenta.

### App Docente v8.23.27
- Se sustituyeron los hotfixes separados de periodos/bitácora por `merit-admin-v82327.js?v=82327`.
- El módulo restaura explícitamente la sesión de profesor antes de consultar RPC de Mérito.
- Reintenta carga de periodos al iniciar, recuperar foco y volver a primer plano.
- Los periodos existentes en base siguen intactos:
  - Prueba Consejo Técnico · 25 septiembre 2026
  - Octubre 2026
- Se agregó una pestaña visible propia en Mérito:
  - **📋 Bitácoras**
- En esa pestaña aparece:
  - selector de periodo
  - los 18 grupos
  - puntos base
  - campo para observaciones
  - descuento automático
  - final estimado
  - botón Guardar revisión de las 18 bitácoras
- La pestaña exige los 18 grupos, incluso 0 observaciones.
- El cierre mensual sigue bloqueado hasta que la revisión mensual requerida esté completa.
- Se mantienen fuera de la regla los periodos de prueba.
- App Docente:
  - v8.23.27
  - caché `app-docente-v8-23-27`
- Sintaxis verificada de:
  - merit-admin-v82327.js
  - service-worker.js
  - merito-docentes/app.js
  - merito-docentes/service-worker.js

### Documento
- La versión definitiva ya no menciona entrega/no entrega de bloc docente.
- Se eliminó también la pregunta frecuente sobre el bloc por ser innecesaria.
- La sección de celular se conserva: uso profesional/institucional para personal + posibilidad de registrar puntos después o desde casa.
- La ubicación de captura de bitácoras se documenta como **App Docente > Mérito > Bitácoras**.
