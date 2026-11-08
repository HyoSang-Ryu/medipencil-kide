import assert from 'node:assert/strict';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const {password,origin='http://127.0.0.1:5173'}=JSON.parse(Buffer.concat(chunks));assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname),'write tests are loopback-only');
let count=0;const check=(a,b)=>{assert.deepEqual(a,b);count++};const sessions=[];
async function req(path,token,method='GET',body,key=crypto.randomUUID()){return fetch(origin+'/api/'+path,{method,headers:{Origin:origin,...token?{'X-MP-Session':token}:{},...method==='GET'?{}:{'Content-Type':'application/json','Idempotency-Key':key}},body:method==='GET'?undefined:JSON.stringify(body)})}
async function login(email){const r=await req('auth/login',null,'POST',{email,password});check(r.status,200);const t=r.headers.getSetCookie().join(';').match(/(?:__Host-)?mp_session=([a-f0-9]{64})/)[1];sessions.push(t);return t}
try{
 const staff=await login('doctor@demo.test'),family=await login('family@demo.test');
 check((await req('voice?patient=p1',family)).status,403);check((await req('voice/text',family,'POST',{patientId:'p1',transcript:'test',syntheticAck:true})).status,403);
 check((await req('voice/text',staff,'POST',{patientId:'p1',transcript:'test'})).status,400);
 check((await req('voice/text',staff,'POST',{patientId:'p999',transcript:'test',syntheticAck:true})).status,404);
 const configuration=await (await req('voice?patient=p1',staff)).json();check(typeof configuration.configured,'boolean');
 check((await req('voice/session',family,'POST',{patientId:'p1',syntheticAck:true})).status,403);
 const sessionResponse=await req('voice/session',staff,'POST',{patientId:'p1',syntheticAck:true});check(sessionResponse.status,configuration.configured?201:503);
 if(configuration.configured){const session=await sessionResponse.json();check(/^https?:\/\/[^/]+\/api\/voice\/stream\/[a-f0-9]{64}$/.test(session.streamUrl),true);check(Object.keys(session).sort(),['encounter','streamUrl'])}
 const before=await (await req('state',family)).json(),key=crypto.randomUUID(),transcript='직원: 점심 식사는 절반 드셨습니다. 오후에 산책할 계획이며 아직 산책하지 않았습니다.';
 let r=await req('voice/text',staff,'POST',{patientId:'p1',transcript:transcript+' KIDE, 정리해줘.',syntheticAck:true},key);check(r.status,201);let e=(await r.json()).encounter;check(e.transcript,transcript);check(e.status,'draft');check(e.execution,'manual');
 check((await (await req('voice/text',staff,'POST',{patientId:'p1',transcript:transcript+' KIDE, 정리해줘.',syntheticAck:true},key)).json()).encounter.id,e.id);
 check((await req('voice/text',staff,'POST',{patientId:'p2',transcript,syntheticAck:true},key)).status,409);
 check((await (await req('state',family)).json()).messages.length,before.messages.length);
 check((await req('voice/'+e.id+'/approve',staff,'POST',{revision:e.revision,reviewed:false,shareFamily:true})).status,409);
 r=await req('voice/'+e.id,staff,'PATCH',{revision:e.revision,note:e.note,familyText:'산책할 계획이며 아직 실시 전입니다.',evidence:'원문에 없는 근거'});check(r.status,200);e=(await r.json()).encounter;
 check((await req('voice/'+e.id+'/approve',staff,'POST',{revision:e.revision,reviewed:true,shareFamily:true})).status,400);
 check((await req('voice/'+e.id,staff,'PATCH',{revision:e.revision-1,note:e.note,familyText:'x',evidence:transcript})).status,409);
 r=await req('voice/'+e.id,staff,'PATCH',{revision:e.revision,note:e.note,familyText:'산책할 계획이며 아직 실시 전입니다.',evidence:'아직 산책하지 않았습니다.'});check(r.status,200);e=(await r.json()).encounter;
 check((await req('voice/'+e.id+'/approve',family,'POST',{revision:e.revision,reviewed:true})).status,403);
 r=await req('voice/'+e.id+'/approve',staff,'POST',{revision:e.revision,reviewed:true,shareFamily:true});check(r.status,200);e=(await r.json()).encounter;check(e.status,'approved');
 const after=await (await req('state',family)).json();check(after.messages.filter(m=>m.id===e.message_id).length,1);check(after.messages.find(m=>m.id===e.message_id).body,'산책할 계획이며 아직 실시 전입니다.');check(JSON.stringify(after).includes(transcript),false);
 check((await req('voice/'+e.id+'/approve',staff,'POST',{revision:e.revision,reviewed:true,shareFamily:true})).status,200);check((await (await req('state',family)).json()).messages.filter(m=>m.id===e.message_id).length,1);
 check((await req('voice/'+e.id,staff,'PATCH',{revision:e.revision,note:e.note,familyText:'overwrite',evidence:transcript})).status,409);
 check((await req('voice/'+e.id+'/withdraw',staff,'POST',{})).status,200);check((await (await req('state',family)).json()).messages.some(m=>m.id===e.message_id),false);
 r=await req('voice/text',staff,'POST',{patientId:'p1',transcript:'合成・엔진 실패 시 원문 보존 QA',syntheticAck:true});e=(await r.json()).encounter;
 const gen=await req('voice/'+e.id+'/generate',staff,'POST',{revision:e.revision,externalAck:true});check(gen.status,503);const saved=(await (await req('voice?patient=p1',staff)).json()).items.find(x=>x.id===e.id);check(saved.transcript,e.transcript);check(['draft','transcribed'].includes(saved.status),true);
 check((await req('voice/'+e.id+'/generate',staff,'POST',{revision:saved.revision,externalAck:false})).status,400);
 const denied=await fetch(origin+'/api/voice/stream/'+'0'.repeat(64),{headers:{Origin:origin}});check(denied.status,403);

 console.log('PASS: '+count+' staff-only access, immutable source, review gate, family excerpt, revision, idempotency, withdrawal and unavailable-engine preservation checks');
}finally{for(const token of sessions)await req('auth/logout',token,'POST',{})}
