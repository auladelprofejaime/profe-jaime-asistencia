export const SUPABASE_URL="https://xqeyyjakmeiaahecfdmc.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY="sb_publishable_GY2NGAigumnZw3rIJKU7LA_a2qigAEA";

async function request(path,{method='GET',body,token,headers={}}={}){
  const h={
    apikey:SUPABASE_PUBLISHABLE_KEY,
    Authorization:`Bearer ${token||SUPABASE_PUBLISHABLE_KEY}`,
    ...headers
  };
  if(body!==undefined)h['Content-Type']='application/json';
  const r=await fetch(SUPABASE_URL+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.message||data?.error_description||data?.hint||`Supabase ${r.status}`);
  return data;
}

export async function portalLogin(studentId,role,pin,remember=false){
  return request('/rest/v1/rpc/portal_login',{method:'POST',body:{p_student_id:String(studentId),p_role:role,p_pin:String(pin),p_remember:!!remember}});
}
export async function changePortalPin(token,newPin){
  return request('/rest/v1/rpc/portal_change_pin',{method:'POST',body:{p_token:token,p_new_pin:String(newPin)}});
}
export async function portalLogout(token){
  return request('/rest/v1/rpc/portal_logout',{method:'POST',body:{p_token:token}});
}
export async function updateFamilyProfile(token,phone,birthdate){
  return request('/rest/v1/rpc/portal_update_family_profile',{
    method:'POST',
    body:{p_token:token,p_tutor_phone:String(phone||''),p_birth_date:birthdate||null}
  });
}
export async function portalGetBundle(token){
  const raw=await request('/rest/v1/rpc/portal_get_bundle',{method:'POST',body:{p_token:token}});
  if(!raw?.ok)return raw;
  const studentRaw=raw.student||{};
  const student={id:studentRaw.id,name:studentRaw.name,shift:studentRaw.shift,group:studentRaw.group_name,number:studentRaw.list_number,guardian:studentRaw.tutor_name||'',phone:studentRaw.tutor_phone||'',birthdate:studentRaw.birth_date||''};
  const attendance=(raw.attendance||[]).map(a=>({...a,studentId:a.student_id,date:a.attendance_date}));
  const activities=[],activityRecords=[];
  for(const x of raw.activities||[]){
    const a=x.activity||{},d=a.data||{},r=x.record||{},rd=r.data||{};
    activities.push({...d,id:a.id,group:a.group_name,shift:a.shift,name:a.title,date:a.activity_date,dueDate:a.due_date||d.dueDate||null,evaluationMode:a.evaluation_type||d.evaluationMode||'delivery',closed:a.closed});
    if(r?.activity_id&&r?.student_id)activityRecords.push({...rd,id:r.id,key:`${r.activity_id}|${r.student_id}`,activityId:r.activity_id,studentId:r.student_id,status:r.delivered===true?'yes':r.delivered===false?'no':(rd.status||''),score:r.score,deliveryDate:r.delivery_date});
  }
  const methodologies=(raw.methodologies||[]).map(m=>({...(m.data||{}),id:m.id,cycle:m.cycle,quarter:m.quarter,month:m.month,shift:m.shift,group:m.group_name,subject:m.subject,closed:m.closed,updated:m.updated_at}));
  const notices=(raw.notices||[]).map(n=>({id:n.id,title:n.title,text:n.body,group:n.group_name,created:n.created_at,active:n.active}));
  const materials=(raw.materials||[]).map(m=>({
    id:m.id,title:m.title,type:m.material_type,source:m.source_type,group:m.group_name,url:m.external_url,
    storagePath:m.storage_path,fileName:m.file_name,mime:m.mime_type,size:m.file_size,active:m.active,
    publicUrl:m.storage_path?`${SUPABASE_URL}/storage/v1/object/public/materials/${encodeURI(m.storage_path)}`:null
  }));
  const studyTopics=(raw.study_topics||[]).map(t=>({...(t.data||{}),id:t.id,title:t.title,notes:t.description,group:t.group_name,active:t.active}));
  const reports=(raw.reports||[]).map(r=>({id:r.id,studentId:r.student_id,title:r.title,created:r.created_at,reportDate:r.report_date,storagePath:r.storage_path}));
  const availabilityRaw=raw.availability||{};
  const availability={id:'main',days:availabilityRaw.working_days||[1,2,3,4,5],start:(availabilityRaw.start_time||'12:00').slice(0,5),end:(availabilityRaw.end_time||'15:00').slice(0,5),vacationStart:availabilityRaw.vacation_start||'',vacationEnd:availabilityRaw.vacation_end||'',technicalCouncilDates:availabilityRaw.suspension_dates||[],suspended:!!availabilityRaw.suspended,temporaryNotice:availabilityRaw.temporary_notice||'',contactOverrideOpen:!!availabilityRaw.contact_override_open,studentChatOverride:availabilityRaw.student_chat_override||'auto',studentChatOverrideDate:availabilityRaw.student_chat_override_date||''};
  return {ok:true,role:raw.role,student,attendance,activities,activityRecords,methodologies,notices,materials,studyTopics,reports,messages:raw.messages||[],availability};
}
export const WEB_PUSH_VAPID_PUBLIC_KEY="BNPj-HUZsEtLYTsRcRdqyYIqhq4hqjRno0QmNbHhSVe5wHeBiqnVnwMx5RU8lxyz-mNhvqbjQRLqsmhqBTdZkWg";
export async function registerPortalPush(token,subscription){
  const j=subscription.toJSON();
  return request('/rest/v1/rpc/register_portal_push',{method:'POST',body:{
    p_token:token,p_endpoint:j.endpoint,p_p256dh:j.keys?.p256dh,p_auth:j.keys?.auth,p_user_agent:navigator.userAgent
  }});
}
export async function unregisterPortalPush(token,endpoint){
  return request('/rest/v1/rpc/unregister_portal_push',{method:'POST',body:{p_token:token,p_endpoint:endpoint}});
}
export async function sendPortalPushEvent(token,event,body={}){
  const r=await fetch(SUPABASE_URL+'/functions/v1/send-push',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({event,portal_token:token,...body})});
  const text=await r.text();let data;try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
  if(!r.ok)throw new Error(data?.error||`Push ${r.status}`);
  return data;
}
export async function portalSendMessage(token,category,message){
  return request('/rest/v1/rpc/portal_send_message',{method:'POST',body:{p_token:token,p_category:category,p_message:message}});
}
