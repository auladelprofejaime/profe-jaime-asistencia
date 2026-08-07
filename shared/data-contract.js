
export const ECOSYSTEM_VERSION='7.0';
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
  portalReports:'id'
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
  portalReports:'portal_reports'
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
