
import {DB_NAME,STORES,DEFAULT_AVAILABILITY} from './data-contract.js';

let db=null;
const req=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
function ensureStores(database){
  for(const [name,keyPath] of Object.entries(STORES)){
    if(!database.objectStoreNames.contains(name))database.createObjectStore(name,{keyPath});
  }
}
async function openDB(){
  if(db)return db;
  let current=await new Promise((ok,no)=>{
    const r=indexedDB.open(DB_NAME);
    r.onupgradeneeded=e=>ensureStores(e.target.result);
    r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
  });
  const missing=Object.keys(STORES).filter(n=>!current.objectStoreNames.contains(n));
  if(missing.length){
    const version=current.version+1;current.close();
    current=await new Promise((ok,no)=>{
      const r=indexedDB.open(DB_NAME,version);
      r.onupgradeneeded=e=>ensureStores(e.target.result);
      r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);
    });
  }
  db=current;return db;
}
async function store(name,mode='readonly'){
  const d=await openDB();
  return d.transaction(name,mode).objectStore(name);
}
export async function all(name){return req((await store(name)).getAll())}
export async function get(name,key){return req((await store(name)).get(key))}
export async function put(name,value){return req((await store(name,'readwrite')).put(value))}
export async function remove(name,key){return req((await store(name,'readwrite')).delete(key))}
export async function getAvailability(){return (await get('availability','main'))||DEFAULT_AVAILABILITY}
export async function getStudentBundle(studentId){
  const [student,attendance,activities,records,methods,notices,materials,topics,reports]=await Promise.all([
    get('students',studentId),all('attendance'),all('activities'),all('activityRecords'),
    all('methodologies'),all('notices'),all('materials'),all('studyTopics'),all('portalReports')
  ]);
  if(!student)return null;
  const same=(a,b)=>String(a||'').replace(/\s+/g,'').toUpperCase()===String(b||'').replace(/\s+/g,'').toUpperCase();
  return {
    student,
    attendance:attendance.filter(x=>x.studentId===studentId),
    activities:activities.filter(a=>same(a.shift,student.shift)&&same(a.group,student.group)),
    activityRecords:records.filter(r=>r.studentId===studentId),
    methodologies:methods.filter(m=>same(m.shift,student.shift)&&same(m.group,student.group)),
    notices:notices.filter(n=>!n.group||same(n.group,student.group)),
    materials:materials.filter(m=>!m.group||same(m.group,student.group)),
    studyTopics:topics.filter(t=>!t.group||same(t.group,student.group)),
    reports:reports.filter(r=>!r.group||same(r.group,student.group)||r.studentId===studentId)
  };
}
