
export const ECOSYSTEM_VERSION='7.8';
export const DB_NAME='ProfeJaimeAsistenciaDB';

export const STORES={
  students:'id',
  attendance:'key',
  activities:'id',
  activityRecords:'key',
  titularWeeks:'id',
  titularRecords:'key',
  settings:'key',
  internalBackups:'id',
  methodologies:'id',
  availability:'id',
  notices:'id',
  materials:'id',
  studyTopics:'id',
  studentMessages:'id',
  portalReports:'id',
  portalAuth:'id'
};

export const ENTITY_TABLES={
  students:'students',
  attendance:'attendance',
  activities:'activities',
  activityRecords:'activity_records',
  methodologies:'methodologies',
  availability:'availability',
  notices:'notices',
  materials:'materials',
  studyTopics:'study_topics',
  studentMessages:'student_messages',
  portalReports:'portal_reports',
  portalAuth:'portal_auth'
};

export const DEFAULT_AVAILABILITY={
  id:'main',
  days:[1,2,3,4,5],
  start:'12:00',
  end:'15:00',
  suspended:false,
  vacationStart:'',
  vacationEnd:'',
  technicalCouncilDates:[],
  temporaryNotice:''
};

export function normalizePhone(phone){
  let d=String(phone||'').replace(/\D/g,'');
  if(d.length===10)d='52'+d;
  return d;
}

// materials: source ('file'|'url'), fileName, mime, size, fileData (local), storagePath (Supabase futuro), url.


export const AUTH_ROLES={student:'student',parent:'parent'};
export const AUTH_POLICY={
  pinLength:6,
  maxAttempts:5,
  lockMinutes:10,
  pbkdf2Iterations:120000,
  shiftAllowed:'Matutino'
};
