import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const origin=process.env.TEST_ORIGIN||'http://localhost:5173';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw Error('Integration tests are local-only.');
const run=crypto.randomUUID().slice(0,8),password='Local-Test-Password-'+run+'!',ip='198.51.100.'+(10+Math.floor(Math.random()*200));
const addresses=Object.fromEntries(['staff','family1','family2','pending'].map(k=>[k,k+'-'+run+'@sites.test']));
const registered=new Set();
class Client{
 constructor(){this.cookies=new Map()}
 async call(path,method='GET',body,extra={}){
  const headers={'CF-Connecting-IP':ip,...extra};if(this.cookies.size)headers.Cookie=[...this.cookies].map(([k,v])=>`${k}=${v}`).join('; ');
  if(body!==undefined){headers['Content-Type']='application/json';headers['Idempotency-Key']??=crypto.randomUUID()}
  const r=await fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});
  for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0],n=pair.indexOf('=');this.cookies.set(pair.slice(0,n),pair.slice(n+1))}
  const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data=raw}return {status:r.status,data}
 }
 async signIn(persona){
 if(persona==='admin'){
  assert.equal((await this.call('/__test/signin?user=admin')).status,302);
  const eligibility=await this.call('/api/auth/admin-setup');assert.equal(eligibility.status,200);
  const migration=new Client();for(const [k,v] of this.cookies)if(k.endsWith('mp_setup'))migration.cookies.set(k,v);
  assert.equal((await migration.call('/api/state')).status,401);
  const setup=await (eligibility.data.canSetup?migration:this).call('/api/auth/admin-setup','POST',{password:'Local-Admin-Password-2026!'});assert.ok([200,409].includes(setup.status),JSON.stringify(setup.data));
  const login=await this.call('/api/auth/login','POST',{email:'seedy@sites.test',password:'Local-Admin-Password-2026!'});assert.equal(login.status,200,JSON.stringify(login.data));return;
 }
 this.email=addresses[persona];this.password=password;
 const method=registered.has(persona)?'login':'register';const r=await this.call('/api/auth/'+method,'POST',{email:this.email,password,name:persona,role:persona==='staff'?'staff':'family'});assert.equal(r.status,method==='register'?201:200,JSON.stringify(r.data));registered.add(persona);
}
 async state(){let r=await this.call('/api/state');assert.equal(r.status,200,JSON.stringify(r.data));return r.data}
}
const anonymous=new Client(),admin=new Client(),staff=new Client(),family=new Client(),other=new Client(),pending=new Client();
assert.equal((await anonymous.call('/api/state')).status,401);
assert.equal((await anonymous.call('/api/session')).data.viewer,null);
const spoof=new Client();await spoof.call('/__test/signin?user=admin');assert.equal((await spoof.call('/api/state')).status,401);
await admin.signIn('admin');await pending.signIn('pending');await staff.signIn('staff');await family.signIn('family1');await other.signIn('family2');
assert.equal((await staff.call('/api/state')).status,403);assert.equal((await family.call('/api/state')).status,403);
assert.equal((await anonymous.call('/api/auth/register','POST',{email:'weak-'+run+'@sites.test',password:'short',name:'weak',role:'family'})).status,400);
assert.equal((await anonymous.call('/api/auth/register','POST',{email:'admin-'+run+'@sites.test',password,name:'admin',role:'admin'})).status,400);
assert.equal((await anonymous.call('/api/auth/register','POST',{email:addresses.family1.toUpperCase(),password,name:'duplicate',role:'family'})).status,409);
assert.equal((await anonymous.call('/api/auth/login','POST',{email:addresses.family1,password:'Wrong-Password-2026!'})).status,401);

assert.equal((await pending.call('/api/state')).status,403);
assert.equal((await pending.call('/api/photos/p1')).status,403);
assert.equal((await pending.call('/api/session','POST',{persona:'staff'})).status,405);
assert.equal((await pending.call('/api/accounts')).status,403);

assert.ok((await admin.call('/api/accounts')).data.requests.some(r=>r.email===addresses.pending));
const grants=[{email:addresses.staff,name:'테스트 의료진',role:'staff',patientIds:[]},{email:addresses.family1,name:'김순자 보호자',role:'family',patientIds:['p1']},{email:addresses.family2,name:'최영숙 보호자',role:'family',patientIds:['p2']}];
for(const grant of grants){const r=await admin.call('/api/accounts','POST',grant);assert.equal(r.status,201,JSON.stringify(r.data))}
await staff.signIn('staff');await family.signIn('family1');await other.signIn('family2');
assert.equal((await family.call('/api/accounts','POST',{...grants[0],email:'escalation@sites.test'})).status,403);
assert.equal((await staff.call('/api/accounts')).status,403);
assert.equal((await family.call('/api/session','POST',{persona:'staff'})).status,405);
assert.equal((await family.call('/api/photos/p2')).status,403);
assert.equal((await other.call('/api/photos/p1')).status,403);
// Upload generated assets only to local R2 and verify patient-scoped delivery.
for(const id of ['p1','p2','p3','p4']){
 const r=await fetch(origin+'/api/photos/'+id,{method:'PUT',headers:{Cookie:[...admin.cookies].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':'image/png'},body:await readFile(new URL('../assets/generated/'+id+'.png',import.meta.url))});
 assert.equal(r.status,200,await r.text());
}
const photo=await fetch(origin+'/api/photos/p1',{headers:{Cookie:[...family.cookies].map(([k,v])=>`${k}=${v}`).join('; ')}});assert.equal(photo.status,200);assert.equal(photo.headers.get('Content-Type'),'image/png');assert.ok((await photo.arrayBuffer()).byteLength>10000);

assert.equal((await staff.state()).patients.length,4);assert.deepEqual((await family.state()).patients.map(p=>p.id),['p1']);assert.deepEqual((await other.state()).patients.map(p=>p.id),['p2']);
const mark='API 검증 '+crypto.randomUUID().slice(0,8);
const care={patientId:'p1',category:'종합 케어',note:mark,temperature:36.6,systolic:124,diastolic:80,glucose:110,meal:90,rehab:25,status:'published'};
let a=await staff.call('/api/logs','POST',care,{'Idempotency-Key':'test-'+mark.split(' ').at(-1)});assert.equal(a.status,201,JSON.stringify(a.data));const log=a.data.log;
assert.equal((await staff.call('/api/logs','POST',care,{'Idempotency-Key':'test-'+mark.split(' ').at(-1)})).data.log.id,log.id);
assert.ok((await family.state()).logs.some(l=>l.id===log.id));assert.ok(!(await other.state()).logs.some(l=>l.id===log.id));
const draft=(await staff.call('/api/logs','POST',{...care,note:'보호자 비공개 임시기록',status:'draft'})).data.log;
assert.ok(!(await family.state()).logs.some(l=>l.id===draft.id));
assert.equal((await family.call('/api/logs/'+draft.id,'PATCH',{})).status,403);
assert.equal((await staff.call('/api/logs/'+draft.id,'PATCH',{})).status,200);assert.ok((await family.state()).logs.some(l=>l.id===draft.id));
assert.equal((await family.call('/api/logs','POST',care)).status,403);
assert.equal((await staff.call('/api/logs','POST',{...care,systolic:70,diastolic:80})).status,400);
const news=(await staff.call('/api/messages','POST',{patientId:'p1',kind:'news',body:'안부 '+mark})).data.message;
assert.ok((await family.state()).messages.some(m=>m.id===news.id));
assert.equal((await family.call('/api/reads','POST',{ids:[news.id]})).status,200);
assert.equal((await staff.state()).messages.find(m=>m.id===news.id).read_by_other,1);
const question=(await family.call('/api/messages','POST',{patientId:'p1',kind:'inquiry',body:'문의 '+mark})).data.message;
assert.ok((await staff.state()).messages.some(m=>m.id===question.id));
assert.equal((await staff.call('/api/messages','POST',{patientId:'p1',kind:'reply',body:'답변 '+mark})).status,201);
assert.ok((await family.state()).messages.some(m=>m.body==='답변 '+mark));
assert.equal((await family.call('/api/messages','POST',{patientId:'p2',kind:'inquiry',body:'권한 검사'})).status,403);
assert.equal((await family.call('/api/messages','POST',{patientId:'p1',kind:'news',senderRole:'staff',body:'역할 위조'})).status,400);
assert.equal((await family.call('/api/reads','POST',{ids:['seed-news-2']})).status,403);
const date=new Date(Date.now()+15*86400000+9*3600000).toISOString().slice(0,10),booking={patientId:'p1',type:'대면 라운지',date,time:'15:00',visitors:2,consent:true};
assert.equal((await family.call('/api/bookings','POST',{...booking,consent:false})).status,400);
assert.equal((await family.call('/api/bookings','POST',{...booking,date:'2026-99-99'})).status,400);
// Cancel an earlier test booking, then exercise the unique active-slot constraint concurrently.
for(const b of (await family.state()).bookings.filter(b=>b.date===date&&b.time==='15:00'&&['approved','pending'].includes(b.status)))await family.call('/api/bookings/'+b.id,'PATCH',{status:'cancelled'});
const concurrent=await Promise.all([family.call('/api/bookings','POST',booking),family.call('/api/bookings','POST',booking)]);
assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409],JSON.stringify(concurrent));const b=concurrent.find(r=>r.status===201).data.booking;
assert.ok((await staff.state()).bookings.some(x=>x.id===b.id));
assert.equal((await family.call('/api/bookings/'+b.id,'PATCH',{status:'approved'})).status,400);
assert.equal((await other.call('/api/bookings/'+b.id,'PATCH',{status:'cancelled'})).status,403);
assert.equal((await staff.call('/api/bookings/'+b.id,'PATCH',{status:'approved'})).status,200);
assert.equal((await family.state()).bookings.find(x=>x.id===b.id).status,'approved');
assert.equal((await family.call('/api/bookings/'+b.id,'PATCH',{status:'cancelled'})).status,200);
assert.equal((await family.call('/api/bookings/'+b.id,'PATCH',{status:'cancelled'})).status,409);
assert.equal((await family.call('/api/messages','POST',{patientId:'p1',kind:'inquiry',body:'CSRF'},{Origin:'https://other.example'})).status,403);
// A fresh browser session can read records created by a different client.
const newBrowser=new Client();await newBrowser.signIn('family1');assert.ok((await newBrowser.state()).logs.some(l=>l.id===log.id));
const accountList=(await admin.call('/api/accounts')).data,guardian=accountList.users.find(u=>u.email===addresses.family1);
assert.equal((await admin.call('/api/accounts/'+guardian.id,'PATCH',{status:'revoked'})).status,200);
assert.equal((await family.call('/api/state')).status,403);assert.equal((await family.call('/api/photos/p1')).status,403);
assert.equal((await admin.call('/api/accounts/'+guardian.id,'PATCH',{status:'active'})).status,200);
assert.equal((await family.state()).actor.patientId,'p1');
assert.equal((await admin.call('/api/accounts','POST',{...grants[1],patientIds:['p2']})).status,201);
assert.deepEqual((await family.state()).patients.map(p=>p.id),['p2']);assert.equal((await family.call('/api/photos/p1')).status,403);
assert.equal((await admin.call('/api/accounts','POST',grants[1])).status,201);
assert.equal((await family.call('/api/auth/password','POST',{currentPassword:'Wrong-Password-2026!',newPassword:password+'new'})).status,401);
assert.equal((await family.call('/api/auth/password','POST',{currentPassword:password,newPassword:password+'new'})).status,200);
assert.equal((await newBrowser.call('/api/state')).status,401); // password changes revoke other sessions
const fresh=new Client();assert.equal((await fresh.call('/api/auth/login','POST',{email:addresses.family1,password})).status,401);
assert.equal((await fresh.call('/api/auth/login','POST',{email:addresses.family1,password:password+'new'})).status,200);
assert.equal((await family.call('/api/auth/logout','POST',{})).status,200);assert.equal((await family.call('/api/state')).status,401);
assert.equal((await anonymous.call('/api/auth/login','POST',{email:addresses.staff,password},{Origin:'https://other.example'})).status,403);
assert.ok(!JSON.stringify((await admin.call('/api/accounts')).data).includes(password));
const limited=new Client();for(let i=0;i<15;i++)assert.equal((await limited.call('/api/auth/login','POST',{email:'absent-'+run+'@sites.test',password})).status,401);
assert.equal((await limited.call('/api/auth/login','POST',{email:'absent-'+run+'@sites.test',password})).status,429);

console.log('PASS: email/password signup and login; password validation; approval gating; password rotation and logout session revocation; login rate limiting; platform identity is not an app login; distinct authenticated identities; admin-issued account grants; fixed account roles; approval gating; guardian links; immediate revocation; protected photos; independent sessions; shared records; draft privacy; patient/role isolation; bidirectional messages; read receipts; booking concurrency/approval/cancellation; validation; CSRF; idempotency; fresh-client persistence.');
