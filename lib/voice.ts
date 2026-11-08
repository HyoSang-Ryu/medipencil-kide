import {createHash,randomBytes} from 'node:crypto';
import {normalizeNote,validateNote,removeEndCommand,cleanFrame} from './voice-contract';
const now=()=>new Date().toISOString(),hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export class VoiceError extends Error{constructor(public status:number,message:string){super(message)}}
const bad=(status:number,s:string):never=>{throw new VoiceError(status,s)};
const txt=(v:any,n=20000)=>typeof v==='string'&&v.trim()&&v.length<=n?v.trim():bad(400,'입력 내용을 확인해 주세요.');
const json=(v:unknown,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store'}});
export function voiceConfig(env:any){
 try{const u=new URL(env.KIDE_BASE_URL);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!env.KIDE_API_KEY)return null;return {origin:u.origin,key:env.KIDE_API_KEY}}catch{return null}
}
export async function ensureVoice(db:D1Database){await db.batch([
 db.prepare(`CREATE TABLE IF NOT EXISTS voice_encounters (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id), author TEXT NOT NULL, status TEXT NOT NULL, transcript TEXT NOT NULL DEFAULT '', note TEXT, family_text TEXT NOT NULL DEFAULT '', evidence TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1, execution TEXT NOT NULL, created_at TEXT NOT NULL, approved_at TEXT, reviewed_by TEXT, request_key TEXT UNIQUE NOT NULL, generation_key TEXT, approval_id TEXT, message_id TEXT, share_active INTEGER NOT NULL DEFAULT 0)`),
 db.prepare(`CREATE TABLE IF NOT EXISTS voice_tickets (token_hash TEXT PRIMARY KEY, encounter_id TEXT NOT NULL, user_id TEXT NOT NULL, session_hash TEXT NOT NULL, expires_at TEXT NOT NULL)`)
]);}
const dto=(e:any)=>({...e,note:e.note?JSON.parse(e.note):null});
export async function voiceApi(request:Request,path:string[],body:any,actor:any,env:any):Promise<Response>{
 if(actor.role!=='staff')return bad(403,'의료진만 진료 녹음과 차트를 사용할 수 있습니다.');
 const db:D1Database=env.DB;await ensureVoice(db);const method=request.method,config=voiceConfig(env);
 const key=()=>actor.userId+':voice:'+txt(request.headers.get('Idempotency-Key'),100);
 const patient=async(id:any)=>{id=txt(id,20);if(!await db.prepare('SELECT id FROM patients WHERE id=?').bind(id).first())bad(404,'환자를 찾을 수 없습니다.');return id};
 if(path.length===1&&method==='GET'){
  const id=await patient(new URL(request.url).searchParams.get('patient'));
  const rows=await db.prepare('SELECT * FROM voice_encounters WHERE patient_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();
  return json({configured:!!config,provider:'KaiLab Round Loop',items:rows.results.map(dto),audioStored:false});
 }
 if(path.length===2&&['session','text'].includes(path[1])&&method==='POST'){
  if(body.syntheticAck!==true)bad(400,'독립 합성 시연 자료만 사용해 주세요.');const pid=await patient(body.patientId),requestKey=key();
  const audio=path[1]==='session';if(audio&&!config)bad(503,'기존 KaiLab 엔진 설정이 필요합니다.');
  const transcript=audio?'':removeEndCommand(txt(body.transcript));if(!audio&&!transcript)bad(400,'전사 내용을 입력해 주세요.');
  let e=await db.prepare('SELECT * FROM voice_encounters WHERE request_key=?').bind(requestKey).first<any>();
  if(e&&(e.patient_id!==pid||e.execution!==(audio?'kailab':'manual')||!audio&&e.transcript!==transcript))bad(409,'같은 요청으로 다른 기록을 만들 수 없습니다.');
  if(!e){const id=crypto.randomUUID();await db.prepare('INSERT INTO voice_encounters (id,patient_id,author,status,transcript,note,execution,created_at,request_key) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,pid,actor.name,audio?'recording':'draft',transcript,audio?null:JSON.stringify({items:[{label:'직접 입력 기록',text:transcript,source:transcript,type:'reported'}],warnings:[],language:'ko'}),audio?'kailab':'manual',now(),requestKey).run();e=await db.prepare('SELECT * FROM voice_encounters WHERE id=?').bind(id).first<any>()}
  if(!audio)return json({encounter:dto(e)},201);
  if(e.status!=='recording')bad(409,'새 녹음으로 시작해 주세요.');
  const token=randomBytes(32).toString('hex');
  const raw=request.headers.get('X-MP-Session')||request.headers.get('cookie')?.match(/(?:^|;\s*)(?:__Host-)?mp_session=([a-f0-9]{64})/)?.[1];if(!raw)return bad(401,'다시 로그인해 주세요.');
  await db.batch([db.prepare('DELETE FROM voice_tickets WHERE user_id=? OR expires_at<?').bind(actor.userId,now()),db.prepare('INSERT INTO voice_tickets (token_hash,encounter_id,user_id,session_hash,expires_at) VALUES (?,?,?,?,?)').bind(hash(token),e.id,actor.userId,hash(raw),new Date(Date.now()+30000).toISOString())]);
  return json({encounter:dto(e),streamUrl:new URL('/api/voice/stream/'+token,request.url).href},201);
 }
 const e=await db.prepare('SELECT * FROM voice_encounters WHERE id=?').bind(path[1]||'').first<any>();if(!e)bad(404,'기록을 찾을 수 없습니다.');
 if(path.length===2&&method==='PATCH'){
  if(!['draft','transcribed','failed'].includes(e.status))bad(409,'편집 가능한 초안이 아닙니다.');
  let note;try{note=validateNote(body.note)}catch{bad(400,'차트 항목을 확인해 주세요.');}
  const familyText=typeof body.familyText==='string'&&body.familyText.length<=2000?body.familyText.trim():bad(400,'보호자 안내는 2,000자 이하로 입력해 주세요.');
  const evidence=typeof body.evidence==='string'&&body.evidence.length<=20000?body.evidence.trim():bad(400,'인용 근거를 확인해 주세요.');
  const r=await db.prepare("UPDATE voice_encounters SET note=?,family_text=?,evidence=?,status='draft',revision=revision+1 WHERE id=? AND revision=? AND status IN ('draft','transcribed','failed')").bind(JSON.stringify(note),familyText,evidence,e.id,body.revision).run();if(!r.meta.changes)bad(409,'다른 변경이 있습니다. 기록을 다시 열어 주세요.');
  return json({encounter:dto(await db.prepare('SELECT * FROM voice_encounters WHERE id=?').bind(e.id).first())});
 }
 if(path[2]==='generate'&&path.length===3&&method==='POST'){
  if(body.externalAck!==true)bad(400,'합성 전사의 외부 AI 처리를 확인해 주세요.');if(!config)bad(503,'기존 KaiLab 엔진 설정이 필요합니다.');
  const generationKey=key();if(e.generation_key===generationKey&&e.status==='draft')return json({encounter:dto(e)});
  if(!['draft','transcribed','failed'].includes(e.status)||!e.transcript)bad(409,'생성 가능한 전사가 없습니다.');
  const r=await db.prepare("UPDATE voice_encounters SET status='generating',generation_key=?,revision=revision+1 WHERE id=? AND revision=? AND status IN ('draft','transcribed','failed')").bind(generationKey,e.id,body.revision).run();if(!r.meta.changes)bad(409,'이미 처리 중이거나 기록이 변경되었습니다.');
  try{
   // Source protocol: send transcript only; do not attach patient DB or family identity.
   const response=await fetch(config!.origin+'/v1/record',{method:'POST',headers:{'Content-Type':'application/json','X-API-Key':config!.key},body:JSON.stringify({transcript:e.transcript}),redirect:'error',signal:AbortSignal.timeout(100000)});
   if(!response.ok)throw Error('engine');const raw=await response.text();if(raw.length>200000)throw Error('schema');const note=normalizeNote(JSON.parse(raw));
   await db.prepare("UPDATE voice_encounters SET note=?,execution='kailab',status='draft',revision=revision+1 WHERE id=? AND status='generating' AND revision=?").bind(JSON.stringify(note),e.id,e.revision+1).run();
   return json({encounter:dto(await db.prepare('SELECT * FROM voice_encounters WHERE id=?').bind(e.id).first())});
  }catch{
   await db.prepare("UPDATE voice_encounters SET status='transcribed',revision=revision+1 WHERE id=? AND status='generating' AND revision=?").bind(e.id,e.revision+1).run();
   bad(503,'기존 KaiLab 엔진에 연결하지 못했습니다. 전사는 저장되어 있으며 엔진 복구 후 다시 생성할 수 있습니다.');
  }
 }
 if(path[2]==='approve'&&path.length===3&&method==='POST'){
  if(e.status==='approved')return json({encounter:dto(e)});
  if(e.status!=='draft'||body.reviewed!==true||body.revision!==e.revision)bad(409,'최신 초안과 원문을 확인한 뒤 저장해 주세요.');
  try{validateNote(JSON.parse(e.note))}catch{bad(400,'확정할 차트가 없습니다.');}
  if(body.shareFamily===true&&(!e.family_text||!e.evidence||!e.transcript.includes(e.evidence)))bad(400,'보호자 안내와 전사 원문에 일치하는 인용 근거가 필요합니다.');
  const approval=crypto.randomUUID(),messageId=crypto.randomUUID(),share=body.shareFamily===true;
  const statements=[db.prepare("UPDATE voice_encounters SET status='approved',approved_at=?,reviewed_by=?,approval_id=?,message_id=?,share_active=?,revision=revision+1 WHERE id=? AND revision=? AND status='draft'").bind(now(),actor.name,approval,share?messageId:null,share?1:0,e.id,e.revision)];
  if(share)statements.push(db.prepare("INSERT INTO messages (id,patient_id,kind,sender_role,sender_name,body,created_at,idempotency_key) SELECT ?,patient_id,'news','staff',?,?,?,? FROM voice_encounters WHERE id=? AND approval_id=?").bind(messageId,actor.name,e.family_text,now(),'voice:'+e.id,e.id,approval));
  statements.push(db.prepare('INSERT INTO audit_events (id,actor,action,entity_id,created_at) SELECT ?,?,?,id,? FROM voice_encounters WHERE id=? AND approval_id=?').bind(crypto.randomUUID(),actor.name,share?'진료 차트 확정 및 안내 공유':'진료 차트 확정',now(),e.id,approval));
  const r=await db.batch(statements);if(!r[0].meta.changes)bad(409,'기록이 변경되었습니다. 다시 확인해 주세요.');return json({encounter:dto(await db.prepare('SELECT * FROM voice_encounters WHERE id=?').bind(e.id).first())});
 }
 if(path[2]==='withdraw'&&method==='POST'){
  await db.prepare('UPDATE voice_encounters SET share_active=0 WHERE id=?').bind(e.id).run();return json({ok:true});
 }
 return bad(405,'지원하지 않는 녹음·차트 요청입니다.');
}
// Native Worker route keeps the 101 upgrade outside framework response conversion.
export async function voiceSocket(request:Request,env:any){
 const url=new URL(request.url),origin=request.headers.get('origin');
 if(request.headers.get('upgrade')?.toLowerCase()!=='websocket'||!origin||![url.origin,'https://hyosang-ryu.github.io'].includes(origin))return new Response(null,{status:403});
 const config=voiceConfig(env),db:D1Database=env.DB;if(!config||!db)return new Response(null,{status:503});await ensureVoice(db);
 const token=url.pathname.split('/').at(-1)||'';if(!/^[a-f0-9]{64}$/.test(token))return new Response(null,{status:403});
 const ticket=await db.prepare('DELETE FROM voice_tickets WHERE token_hash=? AND expires_at>? RETURNING *').bind(hash(token),now()).first<any>();if(!ticket)return new Response(null,{status:403});
 const valid=async()=>!!await db.prepare("SELECT u.id FROM app_users u JOIN auth_sessions s ON u.id=s.user_id JOIN voice_encounters v ON v.id=? WHERE u.id=? AND u.status='active' AND u.role IN ('admin','staff') AND s.token_hash=? AND s.expires_at>? AND v.status='recording'").bind(ticket.encounter_id,ticket.user_id,ticket.session_hash,now()).first();
 if(!await valid())return new Response(null,{status:403});
 let upstream:WebSocket;try{const r=await fetch(config.origin+'/v1/stream?key='+encodeURIComponent(config.key),{headers:{Upgrade:'websocket'},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.webSocket)throw Error('no socket');upstream=r.webSocket;upstream.accept();}catch{await db.prepare("UPDATE voice_encounters SET status='failed' WHERE id=? AND status='recording'").bind(ticket.encounter_id).run();return new Response(null,{status:503});}
 const pair=new WebSocketPair(),client=pair[0],server=pair[1];server.accept();let finished=false,stopping=false,ready=false,total=0,latest='',sequence=Promise.resolve();
 const send=(v:unknown)=>{try{server.send(JSON.stringify(v))}catch{}};
 const end=async(ok:boolean)=>{if(finished)return;finished=true;clearTimeout(deadline);clearInterval(check);try{upstream.close(1000)}catch{}if(!ok){await db.prepare("UPDATE voice_encounters SET status='failed',transcript=? WHERE id=? AND status='recording'").bind(removeEndCommand(latest),ticket.encounter_id).run();send({type:'error',message:'기존 음성 엔진 연결이 종료되었습니다. 표시된 임시 전사는 복사해서 보관할 수 있습니다.'});}try{server.close(ok?1000:1011)}catch{}};
 const deadline=setTimeout(()=>void end(false),180000),check=setInterval(()=>{void valid().then(ok=>{if(!ok)void end(false)}).catch(()=>void end(false))},15000);
 server.addEventListener('message',event=>{if(finished)return;if(typeof event.data==='string'){if(event.data==='{"type":"stop"}'&&!stopping&&ready){stopping=true;upstream.send(event.data)}else void end(false);return}if(!ready||stopping||event.data.byteLength>3200||(total+=event.data.byteLength)>5760000){void end(false);return}upstream.send(event.data)});
 upstream.addEventListener('message',event=>{sequence=sequence.then(async()=>{if(finished)return;let m;try{m=cleanFrame(event.data)}catch{await end(false);return}if(m.type==='ready'){if(ready){await end(false);return}ready=true;send(m)}else if(m.type==='transcript'){latest=m.segments.map((s:any)=>s.text).join('\n');send(m)}else if(m.type==='done'){if(!stopping){await end(false);return}const transcript=removeEndCommand(latest);if(!transcript){await end(false);return}const r=await db.prepare("UPDATE voice_encounters SET transcript=?,status='transcribed',revision=revision+1 WHERE id=? AND status='recording'").bind(transcript,ticket.encounter_id).run();if(!r.meta.changes){await end(false);return}send({type:'done',transcript});await end(true)}}).catch(()=>void end(false))});
 upstream.addEventListener('error',()=>void end(false));upstream.addEventListener('close',()=>{void sequence.finally(()=>end(finished))});server.addEventListener('close',()=>void end(finished));server.addEventListener('error',()=>void end(false));
 return new Response(null,{status:101,webSocket:client});
}
