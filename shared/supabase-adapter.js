
/*
  ADAPTADOR PREPARADO PARA FUTURA MIGRACIÓN A SUPABASE.
  No contiene URL, API key ni conexión activa.
  Cuando llegue la migración, las tres aplicaciones deberán importar
  las mismas funciones de este archivo en lugar de local-adapter.js.
*/
export const SUPABASE_READY=true;

export function createSupabaseAdapter(config){
  if(!config?.url||!config?.anonKey)throw new Error('Supabase aún no está configurado.');
  return {
    mode:'supabase',
    async getStudentBundle(){throw new Error('Pendiente de conectar tablas y políticas RLS.')},
    async getAvailability(){throw new Error('Pendiente de conectar availability.')},
    async sendStudentMessage(){throw new Error('Pendiente de conectar student_messages.')}
  };
}

/*
Tablas previstas:
students
attendance
activities
activity_records
methodologies
availability
notices
materials
study_topics
student_messages
portal_reports
storage bucket previsto: materials

Seguridad futura:
- Profesor: lectura/escritura.
- Alumno: lectura solo de su student_id + inserción de sus mensajes.
- Padre/tutor: lectura solo de sus alumnos vinculados.
- RLS obligatorio.
*/
