import assert from 'node:assert/strict';
const chunks=[];for await(const c of process.stdin)chunks.push(c);
const {origin='https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site',password}=JSON.parse(Buffer.concat(chunks));
assert.ok(password);assert.ok(['localhost','127.0.0.1','medipencil-care-demo-hs1105.ryu22620.chatgpt.site'].includes(new URL(origin).hostname));
const pages='https://hyosang-ryu.github.io';let checks=0;
function check(a,b){assert.deepEqual(a,b);checks++}
async function request(path,options={}){return fetch(origin+'/api/'+path,options)}
let r=await request('state',{method:'OPTIONS',headers:{Origin:pages,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'x-mp-session,x-mp-client'}});check(r.status,204);check(r.headers.get('Access-Control-Allow-Origin'),pages);check(r.headers.get('Access-Control-Allow-Credentials'),null);
r=await request('state',{headers:{Origin:'https://untrusted.example'}});check(r.status,403);check(r.headers.get('Access-Control-Allow-Origin'),null);
r=await request('state',{headers:{Origin:pages,'X-MP-Session':'invalid'}});check(r.status,401);check(r.headers.get('Access-Control-Allow-Origin'),pages);
for(const email of ['admin@demo.test','doctor@demo.test','family@demo.test']){
 r=await request('auth/login',{method:'POST',headers:{Origin:pages,'X-MP-Client':'pages','Content-Type':'application/json'},body:JSON.stringify({email,password})});check(r.status,200);const login=await r.json();assert.match(login.sessionToken,/^[a-f0-9]{64}$/);checks++;check(r.headers.get('set-cookie'),null);
 const headers={Origin:pages,'X-MP-Client':'pages','X-MP-Session':login.sessionToken};
 try{
  r=await request('state',{headers});check(r.status,200);const state=await r.json();
  check(state.patients.map(p=>p.id).sort(),email.startsWith('family')?['p1']:['p1','p2','p3','p4']);
  check((await request('accounts',{headers})).status,email.startsWith('admin')?200:403);
  if(email.startsWith('family')){
   check((await request('photos/p1',{headers})).status,200);check((await request('photos/p2',{headers})).status,403);
   check((await request('messages',{method:'POST',headers:{...headers,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({patientId:'p2',kind:'inquiry',body:'scope test denied'})})).status,403);
  }
 }finally{
  check((await request('auth/logout',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{}'})).status,200);
  check((await request('state',{headers})).status,401);
 }
}
console.log(`PASS: ${checks} Pages CORS, header-session, family isolation, protected photos, admin permission and logout checks.`);
