const OWNER='e35c76f1-b60f-440b-8c88-6acd7efc0128';
const MODEL='gemini-3.5-flash-lite';
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin');const allowed=!origin||origin==='https://auladelprofejaime.github.io';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin&&allowed?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const reply=(s,b)=>new Response(JSON.stringify(b),{status:s,headers});
 if(!allowed)return reply(403,{message:'Origen no autorizado.'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{message:'Método no permitido.'});
 const auth=req.headers.get('authorization')||'';if(!/^Bearer\s+\S+$/i.test(auth))return reply(401,{message:'Inicia sesión de profesor.'});
 try{
  const ur=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{Authorization:auth,apikey:Deno.env.get('SUPABASE_ANON_KEY')||''}});if(!ur.ok)return reply(401,{message:'Sesión vencida.'});const u=await ur.json();if(u.id!==OWNER)return reply(403,{message:'No autorizado.'});
  const body=await req.json(),group=String(body.group||''),students=Array.isArray(body.students)?body.students:[];
  if(!/^(1C|3A|3B|3C)$/.test(group)||!students.length||students.length>40)return reply(400,{message:'Datos incompletos.'});
  const clean=students.map(x=>({student_id:String(x.student_id||''),name:String(x.name||'').slice(0,120),final_score:Number(x.final_score),teacher:x.teacher,peer:x.peer,self:x.self})).filter(x=>x.student_id&&Number.isFinite(x.final_score));
  const schema={type:'object',properties:{feedback:{type:'array',items:{type:'object',properties:{student_id:{type:'string'},text:{type:'string'}},required:['student_id','text']}}},required:['feedback']};
  const prompt='Genera retroalimentación escolar breve, profesional y específica para cada alumno sobre su presentación oral de poema. La evaluación del profesor tiene prioridad; usa autoevaluación y tendencias anónimas de coevaluación solo como complemento. Menciona calificación final, fortalezas, aspectos a mejorar y una recomendación concreta. No menciones nombres ni matrículas de compañeros ni inventes datos. Devuelve solo JSON según este esquema: '+JSON.stringify(schema)+'\nGRUPO '+group+'\nDATOS '+JSON.stringify(clean);
  const key=Deno.env.get('GEMINI_API_KEY');if(!key)return reply(503,{message:'Gemini no está configurado.'});
  const gr=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+MODEL+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:8000}})});
  if(!gr.ok)return reply(503,{message:gr.status===429?'Gemini alcanzó su límite de peticiones. Intenta después.':'Gemini no respondió.'});
  const data=await gr.json(),raw=(data.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join('').trim();let out;try{out=JSON.parse(raw)}catch{return reply(502,{message:'Gemini devolvió un formato inválido.'})}
  if(!Array.isArray(out.feedback))return reply(502,{message:'Respuesta incompleta de Gemini.'});
  return reply(200,{feedback:out.feedback.slice(0,clean.length).map(x=>({student_id:String(x.student_id||''),text:String(x.text||'').slice(0,1600)})),model:MODEL});
 }catch{return reply(503,{message:'No se pudo generar la retroalimentación.'})}
});