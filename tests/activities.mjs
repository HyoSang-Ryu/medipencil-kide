import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const {origin='http://127.0.0.1:5173',password}=JSON.parse(Buffer.concat(chunks));
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'Write tests run only against local synthetic data');
const pageOrigin=origin;let checks=0;const sessions=[],events=[];
const check=(a,b)=>{assert.deepEqual(a,b);checks++};
async function req(path,token,method='GET',body,key=crypto.randomUUID()){
 const binary=body instanceof Uint8Array;return fetch(origin+'/api/'+path,{method,headers:{Origin:pageOrigin,'X-MP-Client':'pages',...(token?{'X-MP-Session':token}:{}),...(method==='GET'?{}:{'Content-Type':binary?'image/png':'application/json','Idempotency-Key':key})},body:method==='GET'?undefined:binary?body:JSON.stringify(body)});
}
async function login(email){const r=await req('auth/login',null,'POST',{email,password});check(r.status,200);await r.json();const sessionToken=r.headers.getSetCookie().join(';').match(/(?:__Host-)?mp_session=([a-f0-9]{64})/)[1];sessions.push(sessionToken);return sessionToken}
const payload={name:'합성 미술 활동 QA',date:'2026-11-08',category:'종합 케어',provenance:'synthetic',patientIds:['p1','p3'],photoCount:2};
let admin,doctor,family;
try{
 admin=await login('admin@demo.test');doctor=await login('doctor@demo.test');family=await login('family@demo.test');
 check((await req('activities',family)).status,403);check((await req('activities',doctor,'POST',payload)).status,403);
 const account={email:'doctor@demo.test',name:'이민우 과장',role:'staff',patientIds:[],canManageActivities:true};
 check((await req('accounts',admin,'POST',account)).status,201);
 check((await (await req('session',doctor)).json()).actor.canManageActivities,true);
 check((await req('activities',doctor,'POST',{...payload,patientIds:[]})).status,400);
 check((await req('activities',doctor,'POST',{...payload,date:'2026-02-30'})).status,400);
 const key=crypto.randomUUID();let r=await req('activities',doctor,'POST',payload,key);check(r.status,201);const id=(await r.json()).event.id;events.push(id);
 check((await (await req('activities',doctor,'POST',payload,key)).json()).event.id,id);
 check((await req('activities/'+id,doctor,'PATCH',{status:'published'})).status,409);
 check((await (await req('state',family)).json()).activities.some(x=>x.event_id===id),false);
 const bytes=await readFile('assets/generated/activities/p1.png'),file1=crypto.randomUUID(),file2=crypto.randomUUID();
 check((await req('activities/'+id+'/photos/'+file1,family,'PUT',bytes)).status,403);
 check((await req('activities/'+id+'/photos/'+file1,doctor,'PUT',Buffer.from('invalid-image-data'))).status,415);
 check((await req('activities/'+id+'/photos/'+file1,doctor,'PUT',bytes)).status,200);
 check((await req('activities/'+id,doctor,'PATCH',{status:'published'})).status,409);
 check((await req('photos/p1/registered-'+file1,family)).status,404);
 check((await req('activities/'+id+'/photos/'+file2,doctor,'PUT',bytes)).status,200);
 check((await req('activities/'+id+'/photos/'+file2,doctor,'PUT',bytes)).status,200);
 check((await req('activities/'+id,doctor,'PATCH',{status:'published'})).status,200);
 let state=await (await req('state',family)).json();const photos=state.activities.filter(x=>x.event_id===id);check(photos.length,2);check(photos.every(x=>x.patient_id==='p1'&&x.synthetic&&x.title===payload.name+' · '+payload.date),true);
 check((await req('photos/p1/registered-'+file1,family)).status,200);check((await req('photos/p3/registered-'+file1,family)).status,403);check((await req('photos/p2/registered-'+file1,admin)).status,404);
 check((await req('accounts',admin,'POST',{...account,canManageActivities:false})).status,201);
 check((await req('activities/'+id,doctor,'PATCH',{status:'withdrawn'})).status,403);
 check((await req('activities/'+id,admin,'PATCH',{status:'withdrawn'})).status,200);
 check((await req('photos/p1/registered-'+file1,family)).status,404);
 state=await (await req('state',family)).json();check(state.activities.some(x=>x.event_id===id),false);
 r=await req('activities',admin,'POST',{...payload,provenance:'real',patientIds:['p2'],photoCount:1});check(r.status,201);const second=(await r.json()).event.id;events.push(second);const realFile=crypto.randomUUID();
 check((await req('activities/'+second+'/photos/'+realFile,admin,'PUT',bytes)).status,200);check((await req('activities/'+second,admin,'PATCH',{status:'published'})).status,200);
 check((await (await req('state',admin)).json()).activities.find(x=>x.event_id===second).synthetic,false);
 check((await (await req('state',family)).json()).activities.some(x=>x.event_id===second),false);
 // A care log can be saved and shared without photo fields.
 check((await req('logs',doctor,'POST',{patientId:'p1',category:'종합 케어',status:'draft',note:'사진 없는 합성 케어 QA'})).status,201);
 console.log('PASS: '+checks+' activity publication, idempotency, scope, provenance, designated manager, revoke and optional-photo checks');
}finally{
 if(admin){for(const id of events)await req('activities/'+id,admin,'PATCH',{status:'withdrawn'});await req('accounts',admin,'POST',{email:'doctor@demo.test',name:'이민우 과장',role:'staff',patientIds:[],canManageActivities:false})}
 for(const token of sessions)await req('auth/logout',token,'POST',{});
}
