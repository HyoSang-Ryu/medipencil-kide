// Read-back check for records created through the browser in the local demo only.
import assert from 'node:assert/strict';
const chunks=[];for await(const c of process.stdin)chunks.push(c);
const {password,origin='http://127.0.0.1:5173'}=JSON.parse(Buffer.concat(chunks));
assert.ok(['localhost','127.0.0.1'].includes(new URL(origin).hostname));assert.ok(password);
const clients=[];
async function login(email){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);const cookie=r.headers.getSetCookie().find(c=>/^(?:__Host-)?mp_session=/.test(c))?.split(';')[0];assert.ok(cookie);const client={cookie,async state(){const r=await fetch(origin+'/api/state',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json()}};clients.push(client);return client;}
try{
 const staff=await login('doctor@demo.test'),family=await login('family@demo.test');
 const s=await staff.state(),f=await family.state();
 const draft=s.logs.find(l=>l.note.includes('STAFF-UI-QA-DRAFT-20261108')),published=s.logs.find(l=>l.note.includes('STAFF-UI-QA-PUBLISHED-20261108'));
 assert.ok(draft);assert.ok(published);assert.equal(draft.status,'draft');assert.equal(published.status,'published');
 for(const record of [draft,published]){assert.equal(record.patient_id,'p1');assert.equal(record.temperature,36.7);assert.equal(record.meal,50);assert.match(record.note,/복약 확인 완료/);assert.match(record.note,/맥박: 78회\/분/);assert.match(record.note,/수분 섭취: 250mL/);assert.match(record.note,/연하·식사 보조: 사레 없음/)}
 assert.ok(!f.logs.some(l=>l.id===draft.id));assert.ok(f.logs.some(l=>l.id===published.id));
 console.log('PASS: browser-entered vital/meal/checklist/pulse/water/swallow values persist; draft is private; published record reaches the linked family.');
}finally{for(const c of clients)await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:c.cookie,'Content-Type':'application/json'},body:'{}'});}
