
import {AUTH_POLICY} from './data-contract.js';
import {getPortalAuth,putPortalAuth,get} from './local-adapter.js';

const enc=new TextEncoder();
const hex=buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
const randomBytes=n=>crypto.getRandomValues(new Uint8Array(n));
const randomSalt=()=>hex(randomBytes(16));
export function generateTempPin(){
  const a=new Uint32Array(1);crypto.getRandomValues(a);
  return String(100000+(a[0]%900000));
}
async function derive(pin,salt,iterations=AUTH_POLICY.pbkdf2Iterations){
  const key=await crypto.subtle.importKey('raw',enc.encode(String(pin)),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations,hash:'SHA-256'},key,256);
  return hex(bits);
}
export async function provisionAuth(studentId,role,force=false){
  const id=`${studentId}|${role}`;
  let existing=await getPortalAuth(studentId,role);
  if(existing&&!force)return {record:existing,tempPin:null};
  const tempPin=generateTempPin(),salt=randomSalt(),hash=await derive(tempPin,salt);
  const record={id,studentId,role,salt,pinHash:hash,tempPinReveal:tempPin,iterations:AUTH_POLICY.pbkdf2Iterations,mustChange:true,failedAttempts:0,lockedUntil:0,updated:new Date().toISOString()};
  await putPortalAuth(record);
  return {record,tempPin};
}
export async function verifyPin(studentId,role,pin){
  const student=await get('students',studentId);
  if(!student)return {ok:false,reason:'not_found'};
  if(String(student.shift||'').toLowerCase()!=='matutino')return {ok:false,reason:'shift'};
  const auth=await getPortalAuth(studentId,role);
  if(!auth)return {ok:false,reason:'not_provisioned'};
  const now=Date.now();
  if(Number(auth.lockedUntil||0)>now)return {ok:false,reason:'locked',lockedUntil:Number(auth.lockedUntil)};
  const hash=await derive(pin,auth.salt,auth.iterations||AUTH_POLICY.pbkdf2Iterations);
  if(hash!==auth.pinHash){
    auth.failedAttempts=Number(auth.failedAttempts||0)+1;
    if(auth.failedAttempts>=AUTH_POLICY.maxAttempts){
      auth.lockedUntil=now+AUTH_POLICY.lockMinutes*60*1000;
      auth.failedAttempts=0;
    }
    auth.updated=new Date().toISOString();await putPortalAuth(auth);
    return {ok:false,reason:auth.lockedUntil>now?'locked':'bad_pin',lockedUntil:auth.lockedUntil||0};
  }
  auth.failedAttempts=0;auth.lockedUntil=0;auth.updated=new Date().toISOString();await putPortalAuth(auth);
  return {ok:true,mustChange:!!auth.mustChange,student,auth};
}
export async function changePin(studentId,role,newPin){
  const auth=await getPortalAuth(studentId,role);if(!auth)throw new Error('Acceso no preparado.');
  const salt=randomSalt(),hash=await derive(newPin,salt);
  auth.salt=salt;auth.pinHash=hash;auth.tempPinReveal='';auth.mustChange=false;auth.failedAttempts=0;auth.lockedUntil=0;auth.updated=new Date().toISOString();
  await putPortalAuth(auth);return auth;
}
