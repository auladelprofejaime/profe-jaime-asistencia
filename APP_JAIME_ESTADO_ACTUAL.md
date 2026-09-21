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


## Mérito — anulación trazable de movimientos v8.23.28
- La App Docente ahora permite anular movimientos erróneos desde Mérito > Movimientos.
- La anulación NO borra físicamente el registro.
- Requiere escribir un motivo de anulación.
- Solo puede hacerse mientras el periodo siga abierto.
- Al anular se conserva:
  - movimiento original
  - grupo
  - puntos/reconocimientos
  - personal que hizo el registro
  - motivo original
  - motivo de anulación
  - fecha/hora de corrección
  - administrador que realizó la anulación
- El movimiento pasa a status=voided y deja de contar en:
  - clasificación
  - reconocimientos
  - cierre mensual
- Los periodos cerrados/publicados no admiten esta modificación.
- Backend reforzado:
  - teacher_merit_void_movement(uuid,text)
  - teacher_merit_movements ahora devuelve period_status, corrected_at y datos de trazabilidad.
- Frontend:
  - merit-movements-v82328.js?v=82328
  - App Docente v8.23.28
  - caché app-docente-v8-23-28
- No se creó ni anuló ningún movimiento real durante la verificación.


## Mérito — solicitudes de revisión del mismo día v8.23.29
- En Mérito Docentes se agregó “REPORTAR ERROR EN UN REGISTRO DE HOY”.
- El docente puede solicitar revisión únicamente de movimientos:
  - creados por él mismo;
  - con status=valid;
  - cuya fecha del movimiento sea HOY en America/Mexico_City.
- La validación es de servidor; cambiar la fecha del dispositivo no permite reportar movimientos anteriores.
- Flujo del docente:
  1. abre “Reportar error en un registro de hoy”;
  2. ve sus movimientos válidos del día;
  3. selecciona el movimiento;
  4. explica qué ocurrió;
  5. envía al Comité.
- La solicitud NO altera automáticamente puntos ni reconocimientos.
- Solo puede existir una solicitud pendiente por movimiento.
- Backend:
  - tabla merit_movement_review_requests, RLS habilitado y acceso directo revocado;
  - merit_my_today_movements(text);
  - merit_request_movement_review(text,uuid,text);
  - teacher_merit_review_requests(text);
  - teacher_merit_resolve_review_request(uuid,text,text).
- En App Docente se agregó Mérito > “⚠️ Aclaraciones”, con contador de pendientes.
- Cada solicitud muestra:
  - docente;
  - fecha/hora;
  - grupo;
  - puntos;
  - motivo original;
  - reconocimientos;
  - explicación del docente.
- Acciones administrativas:
  - “Anular movimiento”: conserva trazabilidad y deja de contabilizarlo.
  - “No procede”: cierra la solicitud sin modificar el movimiento.
- Si se intenta anular cuando el periodo ya no está abierto, el backend lo impide.
- Al crear la solicitud se intenta enviar una notificación push a las suscripciones de App Docente:
  - título: “Aclaración pendiente · Mérito”
  - destino: Mérito > Aclaraciones.
- merit-push actualizado a versión 3 para aceptar el evento merit_correction_request validado con token de Mérito y solicitud pendiente real.
- App Docente:
  - v8.23.29
  - merit-corrections-v82329.js?v=82329
  - caché app-docente-v8-23-29
- Mérito Docentes:
  - app.js?v=22
  - caché merito-docentes-v1-13
- Verificación:
  - JavaScript nuevo pasa validación de sintaxis.
  - token inválido en merit_my_today_movements devuelve unauthorized.
  - no se crearon solicitudes reales durante las pruebas.


## Mérito — clasificación robusta v8.23.30
- Se corrigió el flujo que mostraba el aviso genérico “Sin conexión y todavía no hay una copia local…” ante cualquier fallo al cargar la clasificación.
- Nuevo módulo merit-ranking-v82330.js?v=82330.
- App Docente v8.23.30; caché app-docente-v8-23-30.
- La clasificación ahora:
  - restaura/refresca explícitamente la sesión Supabase antes de consultar;
  - distingue sin internet vs sesión/autorización vs error de consulta;
  - guarda por periodo la última clasificación válida en localStorage;
  - si realmente no hay conexión, muestra la última copia disponible;
  - al recuperar internet intenta actualizar automáticamente.
- Se suprime únicamente el popup viejo que empezaba con “No se pudo cargar la clasificación:”; otros avisos no se alteran.
- No se modificaron movimientos, periodos ni resultados durante esta corrección.


## Mérito — participación de personal por periodo v8.23.31
- Los accesos de prueba 700002–700070 siguen siendo 69, activos, placeholder y no confirmados.
- Durante el periodo de prueba del Consejo Técnico, un acceso no confirmado puede entrar y registrar movimientos de prueba sin completar perfil ni cambiar NIP.
- En periodos oficiales, solo puede registrar movimientos el personal:
  - confirmado;
  - con perfil/NIP formal completado;
  - marcado como participante en ese periodo.
- Nueva tabla: merit_staff_period_participation, con RLS y acceso directo revocado.
- Historial independiente por periodo: quitar participación en un mes no borra ni altera meses anteriores ni desactiva la cuenta global.
- App Docente > Mérito > Docentes autorizados ahora incluye “Participación por periodo” con selector de periodo y estado Participa / No participa.
- Al activar formalmente un folio desde esa sección, se asocia al periodo seleccionado.
- Jaime 700001 quedó marcado como participante de Octubre 2026.
- Backend:
  - teacher_merit_staff_period_matrix(uuid)
  - teacher_merit_set_staff_period_participation(uuid,uuid,boolean)
  - teacher_merit_activate_staff_code_for_period(text,uuid)
  - merit_register_movement aplica participación por periodo oficial y permite modo prueba en periodos de prueba.
- App Docente v8.23.31, módulo merit-staff-period-v82331.js?v=82331, caché app-docente-v8-23-31.
- Mérito Docentes v24, app.js?v=24, caché merito-docentes-v1-15.
- Los accesos de prueba muestran “Acceso de prueba · Consejo Técnico” y no abren el flujo obligatorio de perfil/NIP hasta que sean confirmados formalmente.


## Mérito — IDs reutilizables y acceso pendiente v26
- Los IDs 700002–700070 no se eliminan ni cambian después del Consejo Técnico.
- El mismo ID/NIP puede volver a utilizarse posteriormente para solicitar/confirmar participación en un periodo oficial.
- El 25/09/2026, mientras esté abierto el periodo de prueba “Prueba Consejo Técnico · 25 septiembre 2026”, los accesos no confirmados pueden probar la captura.
- Fuera del periodo de prueba, un ID no confirmado puede iniciar sesión, pero recibe access.mode=pending_confirmation y can_capture=false.
- La app muestra una pantalla de espera:
  “Tu participación está pendiente / Tu ID sigue vigente, pero todavía no tienes autorización para este periodo. Acércate con el Profr. Jaime para confirmar tu participación.”
- El ID no se considera inválido ni se genera otro.
- Al escanear ese mismo ID en App Docente y activarlo para un periodo oficial, teacher_merit_activate_staff_code_for_period confirma el folio y lo marca como participante del periodo seleccionado.
- En su siguiente acceso, si el periodo está activo, la app continúa con alta formal (perfil/NIP/notificaciones) usando el mismo ID.
- Función nueva: merit_access_state_for_staff(uuid), con modos trial, pending_confirmation, not_participating, official y no_open_period.
- merit_login_device y merit_device_info ahora devuelven access y ya no rechazan un ID de prueba fuera del 25; lo dejan en espera de autorización.
- Mérito Docentes:
  - app.js?v=26
  - caché merito-docentes-v1-17


## Mérito — activación formal desde folio y detección automática v8.23.33 / Docentes v27
- En App Docente > Mérito > Docentes autorizados > Participación por periodo, los periodos de prueba quedan excluidos del selector de activación formal.
- El selector de participación formal muestra solo periodos oficiales; actualmente Octubre 2026 es el primero disponible.
- El 25/09, al escanear un folio 700002–700070 y pulsar Activar participación, se confirma el mismo ID y se marca como participante del periodo oficial seleccionado (Octubre), no del periodo de prueba.
- No se genera otro ID ni otro NIP inicial.
- Si el docente ya había iniciado sesión en el mismo dispositivo y mantiene la sesión recordada:
  - no necesita volver a capturar ID/NIP;
  - Mérito Docentes comprueba el estado al volver a primer plano y cada 30 s;
  - al detectar la activación formal abre el flujo de perfil + cambio de NIP;
  - después exige notificaciones.
- Si el docente desvinculó el dispositivo/no recordó sesión, sí deberá volver a ingresar con el mismo ID y NIP inicial.
- App Docente v8.23.33, merit-staff-period-v82333.js?v=82333, caché app-docente-v8-23-33.
- Mérito Docentes app.js?v=27, caché merito-docentes-v1-18.


## Mérito — prueba ampliada de Comité y corte limpio de Octubre
- Periodo de prueba actualizado:
  - label: “Prueba Consejo Técnico · septiembre 2026”
  - inicio: 2026-09-21
  - fin: 2026-09-30
  - status=open
- Acceso del Comité confirmado:
  - disponible desde 2026-09-21 06:00 America/Mexico_City;
  - puede seguir capturando durante los últimos días de septiembre.
- Folios no confirmados 700002–700070:
  - no obtienen acceso general desde el 21;
  - pueden hacer la prueba general únicamente el 25/09/2026.
- Si un folio es confirmado por Jaime, pasa a acceso formal y puede seguir probando en el periodo de septiembre.
- Octubre 2026 sigue siendo un periodo separado (2026-10-01 a 2026-10-23).
- Los movimientos de la prueba de septiembre permanecen como historial, pero NO se trasladan a Octubre.
- Octubre actualmente tiene 0 movimientos; la clasificación inicia en cero por separación de periodos.
- merit_access_state_for_staff y merit_register_movement aplican estas reglas en servidor.
- Mérito Docentes:
  - app.js?v=28
  - caché merito-docentes-v1-19


## Mérito — limpieza automática del periodo de prueba de septiembre
- El periodo de prueba de septiembre se elimina automáticamente al iniciar octubre.
- Trabajo programado:
  - jobid 6
  - jobname merit-september-trial-cleanup-2026
  - schedule 5 6 1 10 * (06:05 UTC = 00:05 America/Mexico_City el 01/10/2026)
  - active=true
- Función: public.merit_cleanup_september_trial_2026()
- La función solo puede ejecutar la limpieza a partir del 01/10/2026; antes devuelve too_early.
- Al ejecutarse elimina exclusivamente el periodo de prueba de septiembre y sus datos dependientes:
  - movimientos/puntos/reconocimientos de prueba;
  - solicitudes de revisión ligadas a esos movimientos;
  - publicaciones/resultados del periodo de prueba si existieran;
  - ajustes/bitácoras, tie-votes y logs ligados al periodo por cascada.
- NO elimina:
  - IDs 700002–700070;
  - NIP, perfiles ni dispositivos;
  - docentes confirmados;
  - participación/autorización de Octubre 2026;
  - movimientos o resultados de Octubre.
- Prueba segura ejecutada el 19/09/2026: devolvió {ok:false, reason:'too_early'} y no borró nada.
- Verificación posterior:
  - periodo de prueba sigue existiendo;
  - 69 IDs docentes siguen intactos;
  - participación de Octubre permanece intacta.


## Mérito — cierre mensual con fin de semana de captura
- Flujo definitivo acordado:
  - Viernes previo: termina la semana ordinaria del periodo.
  - Sábado y domingo: los docentes todavía pueden cargar puntos y reconocimientos pendientes del periodo que cierra.
  - Durante ese mismo fin de semana, Jaime/Comité revisa y captura las 18 bitácoras.
  - Lunes: cierra la captura del periodo anterior; inicia el siguiente periodo; con puntos + bitácoras completos se detectan empates y se abre votación.
  - Lunes a jueves: votación del personal autorizado.
  - Viernes: cierre definitivo del periodo anterior.
  - Lunes siguiente: publicación y anuncio oficial.
- Los puntos, reconocimientos y observaciones desde el lunes de votación ya pertenecen al siguiente periodo.
- Octubre 2026 quedó del 01/10/2026 al 25/10/2026.
- Noviembre 2026 quedó del 26/10/2026 al 22/11/2026.
- merit_register_movement ahora aplica un corte duro: después de ends_at ya no acepta sincronizaciones atrasadas del periodo anterior.
- Mérito Docentes muestra mensaje period_capture_closed cuando corresponda.
- Mérito Docentes v29, service worker cache merito-docentes-v1-20.
- PDF actualizado con este flujo:
  /mnt/data/Merito_Gabino_A_Palma_Proyecto_Definitivo_ACTUALIZADO_2026-09-19.pdf


## Mérito — calendario definitivo 2026-2027 y cierre anual (19-09-2026)
### Periodos oficiales
Los periodos oficiales quedaron encadenados sin huecos ni traslapes:
- Octubre 2026: 01/10/2026–25/10/2026.
- Noviembre 2026: 26/10/2026–22/11/2026.
- Diciembre 2026 - Enero 2027: 23/11/2026–24/01/2027.
  - pausa escolar de captura: 21/12/2026–06/01/2027.
- Febrero 2027: 25/01/2027–21/02/2027.
- Marzo - Abril 2027: 22/02/2027–25/04/2027.
  - pausa escolar de captura: 22/03/2027–04/04/2027.
- Mayo 2027: 26/04/2027–23/05/2027.
- Tramo final - Acumulado anual 2026-2027: 24/05/2027–20/06/2027.
Mayo es el último periodo con premiación mensual.

### Flujo mensual
- El periodo de captura permanece abierto hasta el domingo de corte para que el personal pueda cargar pendientes del fin de semana.
- Durante ese fin de semana Jaime/Comité puede capturar la revisión de las 18 bitácoras.
- El lunes siguiente inicia inmediatamente el periodo nuevo.
- Si con puntos + bitácoras completos existe empate, se abre votación del personal autorizado de lunes a jueves.
- El viernes se hace el cierre definitivo y el lunes siguiente se publica/anuncia.
- Las nuevas conductas desde el lunes ya pertenecen al periodo nuevo.
- El cierre duro de servidor impide sincronizar capturas atrasadas después del ends_at del periodo anterior.

### Recesos oficiales
- merit_current_period_status, merit_access_state_for_staff y merit_register_movement bloquean captura durante los recesos largos.
- En esos días la cuenta del docente se conserva; Mérito Docentes muestra “Receso escolar”.
- Los periodos Diciembre-Enero y Marzo-Abril continúan antes/después del receso, no se dividen en dos premiaciones.

### Tramo final y campeón anual
- No existe un ganador mensual de Junio ni categorías en la clausura.
- Desde 24/05/2027 hasta 20/06/2027 los docentes siguen sumando/restando puntos; esos movimientos solo alimentan el acumulado anual.
- El tramo final no requiere bitácora mensual y está excluido del módulo “Cierre mensual”.
- teacher_merit_annual_ranking suma:
  - resultados mensuales cerrados (ya con descuentos de bitácora);
  - movimientos válidos del tramo final.
- Si el primer lugar anual queda empatado:
  - votación 21–24/06/2027;
  - solo personal confirmado y participante del tramo final puede votar;
  - si la votación vuelve a empatar, resuelve el Comité con nota de trazabilidad.
- El cierre anual solo se habilita a partir del viernes 25/06/2027.
- La publicación oficial del campeón anual 2026-2027 está bloqueada hasta el 09/07/2027.
- Del 21/06 al 09/07 el personal participante puede entrar en modo annual_close para votar, pero no capturar puntos.
- En la clausura del 09/07/2027 se reconoce únicamente:
  - al grupo con mayor puntaje acumulado anual;
  - al asesor del grupo campeón.
- No hay ganadores por categoría en la clausura.
- Distintivo: puede ser botón/pin circular con broche o reconocimiento impreso, según recursos.
- Si el campeón anual es de 1.º o 2.º, conserva un beneficio transferible al siguiente ciclo:
  - se entrega la relación de alumnos integrantes del grupo ganador;
  - al inicio del nuevo ciclo, los docentes que reciban al grupo definen y comunican desde el primer día cuál será el beneficio.
- Si el campeón es de 3.º, recibe reconocimiento de clausura sin beneficio transferible.

### Backend anual
Nueva tabla privada:
- public.merit_annual_results
- RLS enabled; acceso directo anon/auth revocado.

RPCs:
- teacher_merit_annual_status(text)
- teacher_merit_open_annual_tie_vote(text)
- teacher_merit_close_annual(text,text,text)
- teacher_merit_close_annual_tie_vote(text,text,text)
- teacher_merit_publish_annual_official(text)
Los RPC administrativos exigen sesión/rol de administración; anon no tiene EXECUTE.

### App Docente
- versión visible: v8.23.35
- cache: app-docente-v8-23-35
- merit-admin-v82335.js:
  - excluye “Tramo final” de Cierre mensual/Bitácoras.
- merit-annual-v82335.js:
  - tabla acumulada con puntaje mensual + tramo final + total;
  - preparación de cierre anual;
  - apertura/seguimiento/cierre de votación anual;
  - resolución del Comité si persiste empate;
  - publicación del campeón anual.
- merit-staff-period-v82334.js mantiene selector del periodo oficial inmediato.
- Sintaxis de merit-admin-v82335.js y merit-annual-v82335.js validada con new Function.
- index y service worker verificados cargando los módulos v82335.

### Mérito Docentes
- app.js?v=31
- cache: merito-docentes-v1-22
- issue_key annual se presenta como “Campeón anual”.
- Modo annual_close: captura oculta/bloqueada, votación disponible.
- Modo school_recess: muestra pausa por receso, sin confundirla con falta de autorización.
- Notificaciones hablan de “nuevo periodo” y “resultados oficiales”.

### Verificaciones
- Secuencia oficial Oct–Tramo final verificada: todos los periodos son contiguos, sin huecos ni solapamientos.
- Existe exactamente un Tramo final: 24/05/2027–20/06/2027.
- No existen movimientos futuros en los periodos reestructurados al momento del cambio.
- No se ejecutó una votación/cierre anual real porque es un flujo futuro y hacerlo alteraría datos reales; se validaron funciones, permisos, fechas, restricciones y sintaxis.

### PDF definitivo
Archivo:
- /mnt/data/Merito_Gabino_A_Palma_Proyecto_Definitivo_CICLO_2026-2027.pdf
- 11 páginas.
Incluye tabla de calendario, periodos consolidados por recesos, tramo final, cierre anual, reconocimiento al asesor, beneficio transferible y regla de clausura sin categorías.
Renderizado y revisado visualmente sin clipping/overlaps; comparación visual mostró cambios esperados únicamente en las secciones modificadas.


### Complemento reconocimiento anual (asesor)
- public.merit_annual_results incluye advisor_name.
- RPC teacher_merit_set_annual_award_details(p_cycle,p_advisor_name):
  - solo administración;
  - solo después de cerrar el acumulado anual;
  - guarda al asesor del grupo campeón;
  - devuelve grado del campeón y si el beneficio es transferible (1.º/2.º sí; 3.º no).
- teacher_merit_annual_status devuelve:
  - winner_grade;
  - advisor_name;
  - benefit_transferable.
- App Docente v8.23.36:
  - permite capturar y guardar el nombre del asesor una vez definido el campeón;
  - muestra automáticamente si el beneficio pasa al siguiente ciclo;
  - cache app-docente-v8-23-36;
  - merit-annual-v82335.js se carga con query v82336 para forzar actualización.
- No existe actualmente un catálogo previo de asesores por grupo; por eso el nombre se captura administrativamente y no se inventa.


### Mérito Gabino A. Palma — identidad visual copa escolar 2026-09-20
- Cambio exclusivamente visual; no se modificó Supabase ni lógica de negocio.
- Alcance limitado a:
  - Mérito Docentes.
  - Módulo Mérito Gabino A. Palma dentro de App Docente.
- No se modificó el diseño de Asistencia, Actividades, Evaluación, Libros, Diagnóstico ni otros módulos.
- Se reutiliza el logo existente de Mérito Gabino A. Palma; no se creó ni sustituyó el logo.
- Nueva línea visual:
  - azul marino profundo;
  - dorado;
  - marfil/pergamino;
  - laureles/destellos y estética de copa académica genérica;
  - inspiración en competencia escolar ceremonial, sin referencias directas a franquicias.
- Mérito Docentes:
  - styles.css actualizado;
  - theme color PWA cambiado a azul marino;
  - caché merito-docentes-v1-24;
  - styles.css se carga con query v=32;
  - se conservaron flujos, botones, IDs y lógica existentes.
- App Docente:
  - versión visible v8.23.37;
  - caché app-docente-v8-23-37;
  - nuevo estilo encapsulado únicamente bajo #merit;
  - logo, navegación, tarjetas, tablas, formularios y estados de Mérito usan la nueva identidad;
  - los demás módulos conservan el diseño anterior.


### App Docente — Actividades · Pendientes por alumno (2026-09-21)
- App Docente actualizada a v8.23.38.
- Se agregó una nueva pestaña dentro de Actividades: “Pendientes por alumno”.
- Flujo:
  - escanear o escribir el ID del alumno;
  - no requiere seleccionar turno, grupo ni semana;
  - identifica al alumno y revisa todas las actividades registradas para su turno/grupo;
  - muestra total de actividades, completadas/calificadas, pendientes de entrega y actividades numéricas sin calificación.
- Actividades de entrega:
  - “Entregado” no aparece como pendiente;
  - “No entregó” aparece explícitamente;
  - sin registro se clasifica según fecha de entrega: pendiente, entrega hoy, por entregar o fecha vencida.
- Actividades numéricas:
  - si tienen calificación de 0 a 10 se consideran calificadas;
  - si no tienen calificación aparecen en una sección separada como “Sin calificación registrada”;
  - la app aclara que esto no significa automáticamente que el alumno no haya entregado.
- Si el alumno no tiene pendientes ni actividades numéricas sin calificar, aparece “Al corriente”.
- Se puede hacer una nueva consulta inmediatamente después de cada escaneo.
- No se modificó Supabase ni se borraron/cambiaron registros existentes; el módulo consulta las mismas actividades y activityRecords que ya usa la App Docente.
- Nuevo archivo: activities-pending-v82338.js.
- Caché: app-docente-v8-23-38.


### App Docente — estabilidad Supabase + libros masivos (2026-09-21)
- App Docente actualizada a v8.23.39.
- Diagnóstico de conectividad:
  - proyecto Supabase xqeyyjakmeiaahecfdmc verificado como ACTIVE_HEALTHY;
  - una consulta SQL respondió correctamente durante la revisión;
  - la causa observada en la app era la lógica cliente: un solo timeout/fallo transitorio de una petición podía poner cloudOnline=false y el siguiente chequeo lo devolvía a true, generando el efecto visual de “se conecta y desconecta”.
- Nuevo módulo connectivity-books-v82339.js:
  - añade una comprobación real y ligera contra /auth/v1/settings;
  - usa timeout de 8 s;
  - no cambia a estado de reconexión visible por un solo fallo transitorio;
  - requiere fallos consecutivos antes de mostrar desconexión de Supabase cuando navigator.onLine sigue activo;
  - programa recuperación rápida después de un fallo de RPC;
  - conserva la cola offline y no borra datos.
- Libros:
  - en “Estado por alumno” se agregó botón “📦 Solicitar todos los liquidados”;
  - toma únicamente alumnos con pago liquidado y sin estado solicitado/entregado/externo;
  - usa el RPC existente teacher_book_mark_requested;
  - antes de guardar mantiene la confirmación existente con cantidad de libros y monto correspondiente a editorial;
  - no se ejecutó la acción masiva durante pruebas, para no alterar estados reales.
- No hubo cambios de esquema ni borrado de datos en Supabase.
- Caché: app-docente-v8-23-39.
