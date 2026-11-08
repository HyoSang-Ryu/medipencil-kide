import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
const origin='https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site',run=randomUUID().slice(0,8),password='QA-Only-'+randomUUID();
const finish='/tmp/medipencil-qa-'+run+'.finish',reportPath=new URL('../outputs/access-qa-'+run+'.json',import.meta.url);
const checks=[];const record=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push({name,result:'PASS',actual,expected});console.log('PASS '+name)};
class Client{
 constructor(){this.jar=new Map()}
 async call(path,method='GET',body){const headers={};if(this.jar.size)headers.Cookie=[...this.jar].map(([k,v])=>`${k}=${v}`).join('; ');if(body){headers['Content-Type']='application/json';headers['Idempotency-Key']=randomUUID()}
 const r=await fetch(origin+'/api/'+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});for(const c of r.headers.getSetCookie()){const p=c.split(';')[0],n=p.indexOf('=');this.jar.set(p.slice(0,n),p.slice(n+1))}const contentType=r.headers.get('content-type')||'';const data=contentType.includes('application/json')?await r.json():{bytes:(await r.arrayBuffer()).byteLength};return {status:r.status,data}}
}
const admin=new Client(),staff=new Client(),family=new Client(),created=[];
const users={staff:{email:'qa-staff-'+run+'@demo.test',name:'QA의료진 '+run,role:'staff'},family:{email:'qa-family-'+run+'@demo.test',name:'QA보호자 '+run,role:'family'}};
let outcome='FAIL',failure;
try{
 record('관리자 테스트 계정 로그인',(await admin.call('auth/login','POST',{email:'admin@demo.test',password:process.env.TEST_ADMIN_PASSWORD})).status,200);
 record('관리자 권한',(await admin.call('session')).data.actor.isAdmin,true);
 for(const [kind,user] of Object.entries(users)){
  const client=kind==='staff'?staff:family;
  record(kind+' 신규 회원가입',(await client.call('auth/register','POST',{...user,password})).status,201);
  const session=await client.call('session');record(kind+' 승인 대기',session.data.accountStatus,'pending');created.push({kind,id:null,email:user.email});
  record(kind+' 승인 전 환자 조회 차단',(await client.call('state')).status,403);
  record(kind+' 승인 전 사진 차단',(await client.call('photos/p1')).status,403);
 }
 const initial=await admin.call('accounts');for(const u of created)u.id=initial.data.users.find(x=>x.email===u.email).id;
 record('가족 미지정 보호자 승인 거절',(await admin.call('accounts','POST',{...users.family,patientIds:[]})).status,400);
 record('보호자 직접 승인 차단',(await family.call('accounts','POST',{...users.family,patientIds:['p1']})).status,403);
 console.log('READY_UI '+JSON.stringify({run,users,finish,reportPath:reportPath.pathname}));
 const deadline=Date.now()+360000;let ready=false;
 while(Date.now()<deadline){
  const s=await staff.call('session'),f=await family.call('session');
  if(s.data.actor?.role==='staff'&&f.data.actor?.role==='family'&&f.data.actor.patientIds.includes('p1')){ready=true;break}
  await new Promise(r=>setTimeout(r,2000));
 }
 assert.ok(ready,'관리자 화면에서 의료진 승인과 가족 연결 완료 대기 시간 초과');
 record('관리자 화면 승인 후 의료진 조회',(await staff.call('state')).status,200);
 const s=await staff.call('state');record('의료진 환자 조회 범위',s.data.patients.map(x=>x.id).sort(),['p1','p2','p3','p4']);record('의료진 관리자 권한 없음',s.data.actor.isAdmin,false);
 const state=await family.call('state');record('보호자 연결된 가족만 조회',state.data.patients.map(p=>p.id),['p1']);
 for(const key of ['logs','messages','bookings'])record('다른 가족 '+key+' 미반환',state.data[key].every(x=>x.patient_id==='p1'),true);
 record('보호자 감사 이력 비공개',state.data.audit,[]);
 const queried=await family.call('state?patient=p2&role=staff');record('환자·역할 URL 변조에도 본인 가족만 반환',queried.data.patients.map(p=>p.id),['p1']);
 record('본인 가족 사진 조회',(await family.call('photos/p1')).status,200);
 for(const id of ['p2','p3','p4'])record('다른 가족 '+id+' 사진 직접 URL 차단',(await family.call('photos/'+id)).status,403);
 record('다른 가족 문의 전송 차단',(await family.call('messages','POST',{patientId:'p2',kind:'inquiry',body:'QA 권한 차단 검증'})).status,403);
 const otherMessage=s.data.messages.find(m=>m.patient_id==='p2');assert.ok(otherMessage);record('다른 가족 메시지 열람 처리 차단',(await family.call('reads','POST',{ids:[otherMessage.id]})).status,403);
 record('다른 가족 면회 신청 차단',(await family.call('bookings','POST',{patientId:'p2',type:'대면 라운지',date:'2026-11-15',time:'15:00',visitors:1,consent:true})).status,403);
 record('보호자 의료기록 작성 차단',(await family.call('logs','POST',{patientId:'p1',category:'종합 케어',status:'published',note:'QA 권한 검증'})).status,403);
 record('보호자 관리자 API 차단',(await family.call('accounts')).status,403);
 record('보호자 역할 변경 차단',(await family.call('session','POST',{persona:'staff'})).status,405);
 console.log('READY_PROOF '+JSON.stringify({run,finish,checks:checks.length}));
 while(!existsSync(finish)&&Date.now()<deadline)await new Promise(r=>setTimeout(r,1000));
 assert.ok(existsSync(finish),'검증 화면 기록 대기 시간 초과');
 record('관리자 가족 연결 변경',(await admin.call('accounts','POST',{...users.family,patientIds:['p2']})).status,201);
 record('변경 후 새 가족만 조회',(await family.call('state')).data.patients.map(p=>p.id),['p2']);
 record('이전 가족 사진 접근 즉시 회수',(await family.call('photos/p1')).status,403);
 record('새 연결 가족 사진 조회',(await family.call('photos/p2')).status,200);
 outcome='PASS';
}catch(e){failure=e.message;console.error('FAIL '+e.message)}finally{
 const cleanup=[];
 for(const u of created){try{if(!u.id){const data=await admin.call('accounts');u.id=data.data.users.find(x=>x.email===u.email)?.id}if(u.id){const result=await admin.call('accounts/'+u.id,'PATCH',{status:'revoked'});assert.equal(result.status,200);const denied=await (u.kind==='staff'?staff:family).call('state');assert.equal(denied.status,403);cleanup.push({email:u.email,status:'revoked',access:403})}}catch(e){cleanup.push({email:u.email,error:e.message});outcome='FAIL'}}
 for(const client of [staff,family,admin])try{await client.call('auth/logout','POST',{})}catch{}
 if(existsSync(finish))unlinkSync(finish);
 writeFileSync(reportPath,JSON.stringify({run,origin,outcome,failure,checks,cleanup,finishedAt:new Date().toISOString()},null,2));
 console.log('RESULT '+JSON.stringify({outcome,checks:checks.length,cleanup,report:reportPath.pathname}));
 if(outcome!=='PASS')process.exitCode=1;
}
