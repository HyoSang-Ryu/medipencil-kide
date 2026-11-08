import { env } from 'cloudflare:workers';
import { authenticatedMember, authRoute, AuthError } from './password-auth';
import { seed } from './seed';
import {registeredActivities,imageType} from './activities';
import { activityPhotos } from './activity-photos';
import { ensureTestAccounts } from './test-accounts';
import { resolveAccount } from './accounts';
class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const now=()=>new Date().toISOString();
const text=(v:unknown,n=2000)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>n)throw new ApiError(400,`내용은 1~${n}자로 입력해 주세요.`);return v.trim()};
function number(v:unknown,min:number,max:number,integer=false){if(v===null||v===undefined||v==='')return null;const n=Number(v);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw new ApiError(400,'입력 수치의 범위를 확인해 주세요.');return n}
function choice(v:unknown,values:string[]){if(typeof v!=='string'||!values.includes(v))throw new ApiError(400,'선택값을 확인해 주세요.');return v}
let seedPromise:Promise<void>|undefined;
export async function handle(request:Request){
 const origin=request.headers.get('origin'),external=origin==='https://hyosang-ryu.github.io';
 if(origin&&origin!==new URL(request.url).origin&&!external)return json({error:'허용되지 않은 요청입니다.'},403);
 let response:Response;
 if(request.method==='OPTIONS'){
  if(!external)return new Response(null,{status:403});
  const allowed=['content-type','idempotency-key','x-mp-session','x-mp-client'];
  const requested=(request.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
  if(requested.some(x=>!allowed.includes(x)))return new Response(null,{status:403});
  response=new Response(null,{status:204,headers:{'Access-Control-Allow-Methods':'GET,POST,PATCH,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':allowed.join(', '),'Access-Control-Max-Age':'600'}});
 }else{
  // Pages may authenticate only with its session header. Never fall back to cookies.
  response=await handleInternal(request);
 }
 if(external){response.headers.set('Access-Control-Allow-Origin',origin!);response.headers.append('Vary','Origin');}
 return response;
}
async function handleInternal(request:Request){
 try{
  const path=new URL(request.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
  const db=env.DB;if(!db)throw new ApiError(503,'데이터베이스 연결을 확인 중입니다.');
  if(path[0]==='health')return json({ok:true,database:!!(await db.prepare('SELECT 1 AS ok').first()),synthetic:true,authentication:'email-password'});
  if(!['GET','HEAD'].includes(method)){
   const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&origin!=='https://hyosang-ryu.github.io')throw new ApiError(403,'허용되지 않은 요청입니다.');
   if(!(['photos','activities'].includes(path[0])&&method==='PUT')&&!request.headers.get('content-type')?.includes('application/json'))throw new ApiError(415,'JSON 요청이 필요합니다.');
   if(Number(request.headers.get('content-length')||0)>(['photos','activities'].includes(path[0])?5*1024*1024:20000))throw new ApiError(413,'요청이 너무 큽니다.');
  }
  let body:any={};if(!['GET','HEAD'].includes(method)&&!(['photos','activities'].includes(path[0])&&method==='PUT')){let raw=await request.text();if(raw.length>20000)throw new ApiError(413,'요청이 너무 큽니다.');try{body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid body')}catch{throw new ApiError(400,'요청 내용을 확인해 주세요.')}}
  if((path[0]==='session'&&method==='GET')||(path[0]==='auth'&&path[1]==='login'&&method==='POST'))await ensureTestAccounts(db);
  const auth=await authRoute(db,request,path,body);if(auth)return auth;
  const viewer=await authenticatedMember(db,request);
  if(!viewer){if(path[0]==='session'&&method==='GET')return json({actor:null,viewer:null,accountStatus:'anonymous',synthetic:true});throw new ApiError(401,'이메일과 비밀번호로 로그인해 주세요.')}
  const {actor,member}=await resolveAccount(db,viewer);
  if(path[0]==='session'){
   if(method==='GET')return json({actor,viewer:{email:viewer.email,name:viewer.name},accountStatus:member?.status||'unregistered',synthetic:true});

   throw new ApiError(405,'역할은 관리자가 계정에 지정합니다. 역할 선택 로그인은 지원하지 않습니다.');
  }
  if(!actor)throw new ApiError(403,member?.status==='revoked'?'이 계정의 접근 권한이 중지되어 있습니다.':'관리자의 계정 승인과 가족 연결이 필요합니다.');
  if(!seedPromise)seedPromise=seed(db).catch(e=>{seedPromise=undefined;throw e});await seedPromise;
  const staff=()=>{if(actor.role!=='staff')throw new ApiError(403,'의료진만 처리할 수 있습니다.')};
  const patient=async(id:unknown)=>{const pid=text(id,20);if(actor.role!=='staff'&&!actor.patientIds.includes(pid))throw new ApiError(403,'담당 환자의 정보만 확인할 수 있습니다.');const p=await db.prepare('SELECT id FROM patients WHERE id=?').bind(pid).first();if(!p)throw new ApiError(404,'환자를 찾을 수 없습니다.');return pid};
  const event=(action:string,id:string)=>db.prepare('INSERT INTO audit_events (id,actor,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.name,action,id,now());
  const idem=()=>text(request.headers.get('Idempotency-Key'),100);
  if(path[0]==='photos'&&path[1]){
   const pid=await patient(path[1]);const asset=path[2]||'portrait';if(method==='GET'&&asset.startsWith('registered-')){
    const fileId=asset.slice(11);const row=await db.prepare("SELECT f.id,f.content_type FROM activity_files f JOIN activity_events e ON e.id=f.event_id JOIN activity_participants p ON p.event_id=e.id WHERE f.id=? AND p.patient_id=? AND e.status='published'").bind(fileId,pid).first<any>();
    if(!row||path.length>3)throw new ApiError(404,'사진을 찾을 수 없습니다.');const file=await env.BUCKET?.get('activities/'+row.id);if(!file)throw new ApiError(404,'사진을 찾을 수 없습니다.');return new Response(file.body,{headers:{'Content-Type':row.content_type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   }if(path.length>3||(asset!=='portrait'&&!activityPhotos.some(photo=>photo.patient_id===pid&&photo.asset===asset)))throw new ApiError(404,'사진을 찾을 수 없습니다.');if(!env.BUCKET)throw new ApiError(503,'사진 저장소를 연결 중입니다.');
   if(method==='GET'){
    const image=await env.BUCKET.get('patients/'+pid+'/'+asset+'.png');if(!image)throw new ApiError(404,'프로필 사진이 없습니다.');
    return new Response(image.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   }
   if(method==='PUT'){
    if(!actor.isAdmin)throw new ApiError(403,'관리자만 프로필 사진을 등록할 수 있습니다.');
    if(request.headers.get('content-type')!=='image/png')throw new ApiError(415,'PNG 사진을 선택해 주세요.');
    const buffer=await request.arrayBuffer(),bytes=new Uint8Array(buffer);
    if(bytes.length>5*1024*1024||bytes.length<8||![137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))throw new ApiError(400,'5MB 이하 PNG 사진을 선택해 주세요.');
    await env.BUCKET.put('patients/'+pid+'/'+asset+'.png',buffer,{httpMetadata:{contentType:'image/png'}});
    await event('합성 '+(asset==='portrait'?'프로필':'활동')+' 사진 등록',pid).run();return json({ok:true});
   }
  }
  if(path[0]==='activities'){
   if(!actor.canManageActivities)throw new ApiError(403,'관리자 또는 지정된 프로그램 담당자만 등록할 수 있습니다.');
   if(path.length===1&&method==='GET'){
    const events=await db.prepare('SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 100').all();
    const participants=await db.prepare('SELECT * FROM activity_participants').all();
    const files=await db.prepare('SELECT id,event_id FROM activity_files').all();
    return json({events:events.results,participants:participants.results,files:files.results});
   }
   if(path.length===1&&method==='POST'){
    const name=text(body.name,80),date=text(body.date,10),category=choice(body.category,['종합 케어','식사','재활']),provenance=choice(body.provenance,['real','synthetic']);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new ApiError(400,'활동 날짜를 확인해 주세요.');
    const title=body.title?text(body.title,120):name+' · '+date,description=body.description?text(body.description,1000):date+' '+name+' 활동 모습입니다.';
    const ids=Array.isArray(body.patientIds)?[...new Set(body.patientIds.map((x:unknown)=>text(x,20)))]:[];
    if(!ids.length||ids.length>10)throw new ApiError(400,'참여 어르신을 선택해 주세요.');for(const id of ids)await patient(id);
    const count=number(body.photoCount,1,8,true);if(!count)throw new ApiError(400,'사진은 1~8장 선택해 주세요.');
    const key=actor.persona+':activity:'+idem(),prior=await db.prepare('SELECT id,status FROM activity_events WHERE request_key=?').bind(key).first();if(prior)return json({event:prior});
    const id=crypto.randomUUID();await db.batch([db.prepare("INSERT INTO activity_events (id,name,date,category,title,description,provenance,status,author,created_at,request_key,photo_count) VALUES (?,?,?,?,?,?,?,'draft',?,?,?,?)").bind(id,name,date,category,title,description,provenance,actor.name,now(),key,count),...ids.map(pid=>db.prepare('INSERT INTO activity_participants (event_id,patient_id) VALUES (?,?)').bind(id,pid)),event('활동 사진 임시 등록',id)]);return json({event:{id,status:'draft'}},201);
   }
   const e=await db.prepare('SELECT * FROM activity_events WHERE id=?').bind(path[1]||'').first<any>();if(!e)throw new ApiError(404,'활동을 찾을 수 없습니다.');
   if(method==='PUT'&&path.length===4&&path[2]==='photos'){
    if(e.status!=='draft')throw new ApiError(409,'임시 등록 활동만 사진을 추가할 수 있습니다.');
    if(!/^[a-f0-9-]{36}$/.test(path[3]))throw new ApiError(400,'사진 식별자를 확인해 주세요.');
    const existing=await db.prepare('SELECT event_id FROM activity_files WHERE id=?').bind(path[3]).first<any>();if(existing&&existing.event_id!==e.id)throw new ApiError(409,'사진 식별자가 중복되었습니다.');
    const count=await db.prepare('SELECT COUNT(*) AS n FROM activity_files WHERE event_id=?').bind(e.id).first<any>();if(!existing&&count.n>=e.photo_count)throw new ApiError(409,'등록할 사진 수를 초과했습니다.');
    const bytes=new Uint8Array(await request.arrayBuffer());if(bytes.length<12||bytes.length>5*1024*1024)throw new ApiError(400,'사진당 5MB 이하 파일을 선택해 주세요.');
    const type=imageType(bytes);if(!type||type!==request.headers.get('content-type'))throw new ApiError(415,'JPG, PNG 또는 WebP 사진을 선택해 주세요.');if(!env.BUCKET)throw new ApiError(503,'사진 저장소 연결을 확인해 주세요.');
    await env.BUCKET.put('activities/'+path[3],bytes,{httpMetadata:{contentType:type}});
    await db.prepare('INSERT OR IGNORE INTO activity_files (id,event_id,content_type,created_at) VALUES (?,?,?,?)').bind(path[3],e.id,type,now()).run();return json({ok:true});
   }
   if(method==='PATCH'&&path.length===2){
    const status=choice(body.status,['published','withdrawn']);if(status==='published'){
     if(e.status==='withdrawn')throw new ApiError(409,'공유 중단한 활동은 새로 등록해 주세요.');
     const count=await db.prepare('SELECT COUNT(*) AS n FROM activity_files WHERE event_id=?').bind(e.id).first<any>();if(count.n!==e.photo_count)throw new ApiError(409,'사진 업로드를 모두 완료한 뒤 공유해 주세요.');
    }
    await db.batch([db.prepare('UPDATE activity_events SET status=? WHERE id=?').bind(status,e.id),event(status==='published'?'활동 사진 가족 공유':'활동 사진 공유 중단',e.id)]);return json({ok:true});
   }
   throw new ApiError(405,'지원하지 않는 활동 요청입니다.');
  }
  if(path[0]==='accounts'){
   if(!actor.isAdmin)throw new ApiError(403,'관리자만 계정을 관리할 수 있습니다.');
   if(method==='GET'){
    const users=await db.prepare('SELECT id,email,name,role,status,EXISTS(SELECT 1 FROM activity_managers am WHERE am.user_id=app_users.id) AS can_manage_activities,EXISTS(SELECT 1 FROM password_credentials c WHERE c.user_id=app_users.id) AS signed_in,created_at FROM app_users ORDER BY created_at DESC').all();
    const links=await db.prepare('SELECT * FROM family_links').all(),requests=await db.prepare("SELECT * FROM access_requests WHERE status='pending' ORDER BY created_at DESC").all();
    return json({users:users.results,links:links.results,requests:requests.results,patients:(await db.prepare('SELECT id,name,room FROM patients ORDER BY room').all()).results});
   }
   if(method==='POST'){
    const email=text(body.email,254).toLowerCase(),name=text(body.name,80),role=choice(body.role,['staff','family']);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'이메일 주소를 확인해 주세요.');
    const ids=Array.isArray(body.patientIds)?[...new Set(body.patientIds.map((x:unknown)=>text(x,20)))]:[];
    if(ids.length>10||role==='family'&&!ids.length)throw new ApiError(400,'보호자는 연결할 가족을 한 명 이상 지정해야 합니다.');
    for(const id of ids)await patient(id);
    const existing=await db.prepare('SELECT id,role FROM app_users WHERE email=?').bind(email).first<{id:string;role:string}>();
    if(existing?.role==='admin')throw new ApiError(409,'관리자 계정은 이 화면에서 변경할 수 없습니다.');
    if(!existing||!await db.prepare('SELECT user_id FROM password_credentials WHERE user_id=?').bind(existing.id).first())throw new ApiError(400,'사용자가 이메일과 비밀번호로 먼저 회원가입해야 합니다.');
    const id=existing.id,ts=now();
    const statements=[db.prepare("INSERT INTO app_users (id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,'active',?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,status='active',updated_at=excluded.updated_at").bind(id,email,name,role,ts,ts),db.prepare('DELETE FROM family_links WHERE user_id=?').bind(id)];
    if(role==='family')for(const pid of ids)statements.push(db.prepare('INSERT INTO family_links (id,user_id,patient_id) VALUES (?,?,?)').bind(crypto.randomUUID(),id,pid));
    statements.push(db.prepare('DELETE FROM activity_managers WHERE user_id=?').bind(id));
    if(role==='staff'&&body.canManageActivities===true)statements.push(db.prepare('INSERT INTO activity_managers (user_id) VALUES (?)').bind(id));
    statements.push(db.prepare("UPDATE access_requests SET status='approved' WHERE email=?").bind(email),event('계정 권한 및 가족 연결',id));
    await db.batch(statements);return json({ok:true,id},201);
   }
   if(method==='PATCH'&&path[1]){
    const target=await db.prepare('SELECT * FROM app_users WHERE id=?').bind(path[1]).first<any>();if(!target)throw new ApiError(404,'계정이 없습니다.');
    if(target.role==='admin')throw new ApiError(409,'관리자 계정은 중지할 수 없습니다.');
    const status=choice(body.status,['active','revoked']);
    if(status==='active'){
     if(!await db.prepare('SELECT user_id FROM password_credentials WHERE user_id=?').bind(target.id).first())throw new ApiError(400,'먼저 이메일과 비밀번호로 회원가입해야 합니다.');
     if(target.role==='family'&&!await db.prepare('SELECT id FROM family_links WHERE user_id=? LIMIT 1').bind(target.id).first())throw new ApiError(400,'보호자는 가족을 먼저 연결해야 합니다.');
    }
    await db.batch([db.prepare('UPDATE app_users SET status=?,updated_at=? WHERE id=?').bind(status,now(),target.id),event('계정 '+(status==='active'?'활성화':'접근 중지'),target.id)]);return json({ok:true});
   }
  }
  if(path[0]==='state'&&method==='GET'){
   const params=actor.role==='staff'?[]:actor.patientIds;
   const placeholders=params.map(()=>'?').join(',')||'NULL';
   const patientWhere=actor.role==='staff'?'':` WHERE id IN (${placeholders})`;
   const p=await db.prepare('SELECT * FROM patients'+patientWhere+' ORDER BY room').bind(...params).all();
   const scope=actor.role==='staff'?'':` AND patient_id IN (${placeholders})`;
   const l=await db.prepare(`SELECT * FROM care_logs WHERE 1=1 ${actor.role==='staff'?'':"AND status='published'"}${scope} ORDER BY created_at DESC,id DESC LIMIT 500`).bind(...params).all();
   const m=await db.prepare(`SELECT m.*,EXISTS(SELECT 1 FROM message_reads r WHERE r.message_id=m.id AND r.persona IN (SELECT id FROM app_users WHERE status='active' AND ((m.sender_role='staff' AND role='family') OR (m.sender_role='family' AND role IN ('staff','admin'))))) AS read_by_other FROM messages m WHERE 1=1${scope.replace('patient_id','m.patient_id')} ORDER BY m.created_at DESC,m.id DESC LIMIT 500`).bind(...params).all();
   const b=await db.prepare(`SELECT * FROM bookings WHERE 1=1${scope} ORDER BY date DESC,time DESC LIMIT 200`).bind(...params).all();
   const a=actor.role==='staff'?await db.prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 30').all():{results:[]};
   return json({actor,patients:p.results,logs:l.results,activities:[...await registeredActivities(db,actor.role==='staff'?null:params),...activityPhotos.filter(photo=>p.results.some(patient=>patient.id===photo.patient_id))],messages:[...m.results].reverse(),bookings:b.results,audit:a.results,serverTime:now(),synthetic:true});
  }
  if(path[0]==='logs'&&method==='POST'){
   staff();const pid=await patient(body.patientId),key=actor.persona+':'+pid+':'+idem(),id=crypto.randomUUID();
   const category=choice(body.category,['활력징후','투약','식사','재활','종합 케어']),status=choice(body.status,['draft','published']),note=text(body.note);
   const vals=[number(body.temperature,34,43),number(body.systolic,50,250,true),number(body.diastolic,30,160,true),number(body.glucose,20,600,true),number(body.meal,0,100,true),number(body.rehab,0,360,true)];
   if(vals[1]!==null&&vals[2]!==null&&vals[1]<=vals[2])throw new ApiError(400,'수축기 혈압은 이완기 혈압보다 높아야 합니다.');
   await db.batch([db.prepare('INSERT OR IGNORE INTO care_logs (id,patient_id,category,note,temperature,systolic,diastolic,glucose,meal,rehab,status,author,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,pid,category,note,...vals,status,actor.name,now(),key),event(status==='draft'?'케어 임시저장':'케어 기록 공유',id)]);
   const result=await db.prepare('SELECT * FROM care_logs WHERE idempotency_key=?').bind(key).first();return json({log:result},201);
  }
  if(path[0]==='logs'&&path[1]&&method==='PATCH'){
   staff();const l=await db.prepare('SELECT * FROM care_logs WHERE id=?').bind(path[1]).first<any>();if(!l)throw new ApiError(404,'기록이 없습니다.');if(l.status!=='draft')throw new ApiError(409,'이미 공유된 기록입니다.');
   await db.batch([db.prepare("UPDATE care_logs SET status='published' WHERE id=? AND status='draft'").bind(l.id),event('임시 기록 공유',l.id)]);return json({ok:true});
  }
  if(path[0]==='messages'&&method==='POST'){
   const pid=await patient(body.patientId),key=actor.persona+':'+pid+':'+idem(),content=text(body.body),kind=actor.role==='staff'?choice(body.kind,['news','reply']):choice(body.kind,['inquiry','cheer','reply']);
   const id=crypto.randomUUID();await db.batch([db.prepare('INSERT OR IGNORE INTO messages (id,patient_id,kind,sender_role,sender_name,body,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?)').bind(id,pid,kind,actor.role,actor.name,content,now(),key),event(kind==='news'?'안부 발송':'메시지 전송',id)]);
   return json({message:await db.prepare('SELECT * FROM messages WHERE idempotency_key=?').bind(key).first()},201);
  }
  if(path[0]==='reads'&&method==='POST'){
   const ids=body.ids;if(!Array.isArray(ids)||ids.length>100)throw new ApiError(400,'열람 항목을 확인해 주세요.');const statements=[];
   for(const id of ids){const m=await db.prepare('SELECT * FROM messages WHERE id=?').bind(text(id,100)).first<any>();if(!m)continue;await patient(m.patient_id);if(m.sender_role===actor.role)continue;statements.push(db.prepare('INSERT OR IGNORE INTO message_reads (id,message_id,persona,read_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(),m.id,actor.persona,now()))}
   if(statements.length)await db.batch(statements);return json({ok:true});
  }
  if(path[0]==='bookings'&&method==='POST'){
   if(actor.role!=='family')throw new ApiError(403,'보호자 화면에서 신청해 주세요.');
   const pid=await patient(body.patientId),key=actor.persona+':'+pid+':'+idem(),type=choice(body.type,['대면 라운지','온실 정원','영상 면회']),date=text(body.date,10),time=choice(body.time,['10:30','14:00','15:00','16:30']),visitors=number(body.visitors,1,4,true);
   if(!visitors||body.consent!==true)throw new ApiError(400,'인원과 필수 동의를 확인해 주세요.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date+'T00:00:00Z').getTime())||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new ApiError(400,'유효한 날짜를 선택해 주세요.');
   const instant=new Date(date+'T'+time+':00+09:00');if(instant<=new Date()||instant.getTime()>Date.now()+30*86400000)throw new ApiError(400,'현재 이후 30일 이내 일정을 선택해 주세요.');
   const id=crypto.randomUUID(),ts=now();
   const previous=await db.prepare('SELECT * FROM bookings WHERE idempotency_key=?').bind(key).first();if(previous)return json({booking:previous},200);
   try{await db.batch([db.prepare("INSERT INTO bookings (id,patient_id,type,date,time,visitors,status,requested_by,created_at,updated_at,idempotency_key) VALUES (?,?,?,?,?,?,'pending',?,?,?,?)").bind(id,pid,type,date,time,visitors,actor.name,ts,ts,key),event('면회 신청',id)])}catch(e){if(String(e).includes('UNIQUE'))throw new ApiError(409,'이미 예약된 시간입니다. 다른 시간을 선택해 주세요.');throw e}
   return json({booking:await db.prepare('SELECT * FROM bookings WHERE id=?').bind(id).first()},201);
  }
  if(path[0]==='bookings'&&path[1]&&method==='PATCH'){
   const b=await db.prepare('SELECT * FROM bookings WHERE id=?').bind(path[1]).first<any>();if(!b)throw new ApiError(404,'예약이 없습니다.');await patient(b.patient_id);
   const status=choice(body.status,actor.role==='staff'?['approved','rejected','cancelled']:['cancelled']);
   if(!['pending','approved'].includes(b.status)||((status==='approved'||status==='rejected')&&b.status!=='pending'))throw new ApiError(409,'이미 처리된 예약입니다.');
   const result=await db.prepare('UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status=?').bind(status,now(),b.id,b.status).run();if(!result.meta.changes)throw new ApiError(409,'예약 상태가 변경되었습니다. 새로 확인해 주세요.');await event('면회 '+({approved:'승인',rejected:'반려',cancelled:'취소'}[status]),b.id).run();return json({ok:true});
  }
  throw new ApiError(404,'요청한 기능을 찾을 수 없습니다.');
 }catch(e){if(e instanceof ApiError||e instanceof AuthError)return json({error:e.message},e.status);console.error('API failure',e);return json({error:'서버 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'},500)}
}
