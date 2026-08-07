# Preparación para Supabase

La versión 7.0 NO se conecta todavía a Supabase.

Las tres aplicaciones consumen una capa de datos común. En esta versión el
adaptador activo es IndexedDB (`local-adapter.js`). Para sincronización real
entre iPad del profesor, teléfonos de alumnos y teléfonos de padres será
necesaria una base remota y autenticación.

La migración futura debe:
1. Crear las tablas indicadas en `data-contract.js`.
2. Migrar los registros locales.
3. Configurar autenticación.
4. Configurar Row Level Security.
5. Sustituir el adaptador local por `supabase-adapter.js`.
6. Mantener las interfaces de lectura/escritura para evitar rehacer las apps.
