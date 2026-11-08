import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const chunks=[];for await(const c of process.stdin)chunks.push(c);
const {password,origin='https://medipencil-care-demo-hs1105.ryu22620.chatgpt.site'}=JSON.parse(Buffer.concat(chunks));
assert.ok(password);assert.ok(['localhost','127.0.0.1','medipencil-care-demo-hs1105.ryu22620.chatgpt.site'].includes(new URL(origin).hostname));
const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@demo.test',password})});assert.equal(login.status,200);
const cookie=login.headers.getSetCookie().find(c=>/^(?:__Host-)?mp_session=/.test(c))?.split(';')[0];assert.ok(cookie);
const assets=[['p1','activity-art','p1'],['p1','activity-garden','p1-garden'],['p1','activity-meal','p1-meal'],['p2','activity-flowers','p2'],['p3','activity-exercise','p3'],['p4','activity-gardening','p4']];
try{for(const [patient,asset,file] of assets){const bytes=await readFile(new URL('../assets/generated/activities/'+file+'.png',import.meta.url));const r=await fetch(origin+'/api/photos/'+patient+'/'+asset,{method:'PUT',headers:{Cookie:cookie,'Content-Type':'image/png'},body:bytes});assert.equal(r.status,200,await r.text());console.log('Uploaded synthetic activity:',patient,asset);}}
finally{await fetch(origin+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'});}
