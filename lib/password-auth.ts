import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import type { Member } from './accounts';
export class AuthError extends Error{constructor(public status:number,message:string){super(message)}}
const ts=()=>new Date().toISOString();
const reply=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const cookieName=(request:Request)=>new URL(request.url).protocol==='https:'?'__Host-mp_session':'mp_session';
function token(request:Request){const bearer=request.headers.get('X-MP-Session');if(bearer)return /^[a-f0-9]{64}$/.test(bearer)?bearer:null;const name=cookieName(request);const found=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1);return found&&/^[a-f0-9]{64}$/.test(found)?found:null}
function cookie(request:Request,value:string,maxAge=86400){return `${cookieName(request)}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export function validateEmail(value:unknown){if(typeof value!=='string'||value.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new AuthError(400,'이메일 주소를 확인해 주세요.');return value.trim().toLowerCase()}
export function validatePassword(value:unknown){if(typeof value!=='string'||value.length<12||value.length>128)throw new AuthError(400,'비밀번호는 12~128자로 입력해 주세요.');return value}
function derive(password:string,salt:string):Promise<Buffer>{return new Promise((resolve,reject)=>scrypt(password,salt,32,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)))}
export async function hashPassword(password:string){const salt=randomBytes(16).toString('hex'),key=await derive(password,salt);return `scrypt$32768$8$3$${salt}$${key.toString('hex')}`}
async function verify(password:string,encoded:string|null){const match=encoded?.match(/^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/);const key=await derive(password,match?.[1]||'00000000000000000000000000000000'),expected=Buffer.from(match?.[2]||'0'.repeat(64),'hex');return timingSafeEqual(key,expected)&&!!match}
async function limit(db:D1Database,key:string,max:number){const now=Date.now(),reset=now+15*60*1000,id=digest(key);const row=await db.prepare('INSERT INTO auth_rate_limits (key,hits,reset_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN reset_at<=? THEN 1 ELSE hits+1 END,reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING hits').bind(id,reset,now,now).first<{hits:number}>();if(!row||row.hits>max)throw new AuthError(429,'요청이 너무 많습니다. 15분 뒤 다시 시도해 주세요.')}
async function issue(db:D1Database,request:Request,userId:string){const raw=randomBytes(32).toString('hex');await db.prepare('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)').bind(digest(raw),userId,ts(),new Date(Date.now()+86400000).toISOString()).run();return raw}
async function signedIn(db:D1Database,request:Request,userId:string,body:Record<string,unknown>={ok:true},status=200){
 const raw=await issue(db,request,userId);
 // Cross-site Pages sessions use an explicit header, never third-party cookies.
 if(request.headers.get('origin')==='https://hyosang-ryu.github.io'&&request.headers.get('X-MP-Client')==='pages')return reply({...body,sessionToken:raw},status);
 return reply(body,status,{'Set-Cookie':cookie(request,raw)});
}
export async function authenticatedMember(db:D1Database,request:Request){const raw=token(request);if(!raw)return null;return db.prepare('SELECT u.* FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(digest(raw),ts()).first<Member>()}
const setupCookieName=(request:Request)=>new URL(request.url).protocol==='https:'?'__Host-mp_setup':'mp_setup';
function setupToken(request:Request){const name=setupCookieName(request);const v=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);return v&&/^[a-f0-9]{64}$/.test(v)?v:null}
function setupCookie(request:Request,value:string,maxAge=86400){return `${setupCookieName(request)}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
async function setupOwner(db:D1Database,request:Request){
 const grant=setupToken(request);
 if(grant){const owner=await db.prepare("SELECT u.* FROM admin_setup_grants g JOIN app_users u ON u.id=g.user_id WHERE g.token_hash=? AND g.expires_at>? AND u.role='admin' AND u.status='active'").bind(digest(grant),ts()).first<Member>();if(owner)return owner}

 // Migration only: the existing, already verified Site owner may set the first password once.
 // Ordinary authentication never accepts platform identity headers.
 const legacy=await getChatGPTUser();if(!legacy||!env.ADMIN_EMAIL||legacy.email.trim().toLowerCase()!==env.ADMIN_EMAIL.trim().toLowerCase())return null;
 let member=await db.prepare("SELECT * FROM app_users WHERE email=? AND role='admin' AND (auth_user_id=? OR auth_user_id IS NULL)").bind(legacy.email.trim().toLowerCase(),legacy.userId).first<Member>();
 if(!member){const id=crypto.randomUUID(),t=ts();await db.prepare("INSERT OR IGNORE INTO app_users (id,auth_user_id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,'admin','active',?,?)").bind(id,legacy.userId,legacy.email.trim().toLowerCase(),legacy.displayName,t,t).run();member=await db.prepare("SELECT * FROM app_users WHERE id=? AND role='admin'").bind(id).first<Member>()}
 return member;
}
export async function authRoute(db:D1Database,request:Request,path:string[],body:any):Promise<Response|null>{
 if(path[0]!=='auth')return null;
 const action=path[1],method=request.method,ip=request.headers.get('cf-connecting-ip')||'local';
 if(action==='admin-setup'&&method==='GET'){
  const owner=await setupOwner(db,request);if(!owner)throw new AuthError(403,'기존 관리자 계정의 최초 비밀번호 설정 화면입니다.');
  const credential=await db.prepare('SELECT user_id FROM password_credentials WHERE user_id=?').bind(owner.id).first();
  if(credential)return reply({canSetup:false,email:owner.email});
  const raw=randomBytes(32).toString('hex');await db.prepare('INSERT INTO admin_setup_grants (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(digest(raw),owner.id,new Date(Date.now()+86400000).toISOString()).run();
  return reply({canSetup:true,email:owner.email},200,{'Set-Cookie':setupCookie(request,raw)});
 }
 if(action==='admin-setup'&&method==='POST'){
  const owner=await setupOwner(db,request);if(!owner)throw new AuthError(403,'기존 관리자 본인 확인이 필요합니다.');
  if(await db.prepare('SELECT user_id FROM password_credentials WHERE user_id=?').bind(owner.id).first())throw new AuthError(409,'이미 비밀번호를 설정했습니다. 이메일과 비밀번호로 로그인해 주세요.');
  await limit(db,'setup:'+owner.id,5);const password=validatePassword(body.password),hash=await hashPassword(password),t=ts();
  await db.batch([db.prepare('INSERT INTO password_credentials (user_id,password_hash,created_at,updated_at) VALUES (?,?,?,?)').bind(owner.id,hash,t,t),db.prepare('DELETE FROM admin_setup_grants WHERE user_id=?').bind(owner.id)]);
  const result=await signedIn(db,request,owner.id);result.headers.append('Set-Cookie',setupCookie(request,'',0));return result;
 }
 if(action==='register'&&method==='POST'){
  await limit(db,'register-ip:'+ip,10);const email=validateEmail(body.email),password=validatePassword(body.password);
  if(typeof body.name!=='string'||!body.name.trim()||body.name.trim().length>80)throw new AuthError(400,'이름을 1~80자로 입력해 주세요.');
  if(!['staff','family'].includes(body.role))throw new AuthError(400,'의료진 또는 보호자를 선택해 주세요.');
  const old=await db.prepare('SELECT * FROM app_users WHERE email=?').bind(email).first<Member>();
  if(old?.role==='admin'||email===env.ADMIN_EMAIL?.trim().toLowerCase())throw new AuthError(409,'관리자 계정은 최초 비밀번호 설정 화면을 이용해 주세요.');
  if(old&&await db.prepare('SELECT user_id FROM password_credentials WHERE user_id=?').bind(old.id).first())throw new AuthError(409,'이미 회원가입된 이메일입니다. 로그인해 주세요.');
  const id=old?.id||crypto.randomUUID(),name=body.name.trim(),t=ts(),hash=await hashPassword(password);
  try{await db.batch([
   db.prepare("INSERT INTO app_users (id,email,name,role,status,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,status='pending',updated_at=excluded.updated_at").bind(id,email,name,body.role,t,t),
   db.prepare('INSERT INTO password_credentials (user_id,password_hash,created_at,updated_at) VALUES (?,?,?,?)').bind(id,hash,t,t),
   db.prepare('DELETE FROM family_links WHERE user_id=?').bind(id),
   db.prepare("INSERT INTO access_requests (id,auth_user_id,email,name,requested_role,status,created_at) VALUES (?,?,?,?,?,'pending',?) ON CONFLICT(auth_user_id) DO UPDATE SET name=excluded.name,requested_role=excluded.requested_role,status='pending'").bind(crypto.randomUUID(),'password:'+id,email,name,body.role,t)
  ])}catch(error){if(String(error).includes('UNIQUE'))throw new AuthError(409,'이미 회원가입된 이메일입니다. 로그인해 주세요.');throw error}
  return signedIn(db,request,id,{ok:true,accountStatus:'pending'},201);
 }
 if(action==='login'&&method==='POST'){
  await limit(db,'login-ip:'+ip,120);const email=validateEmail(body.email);
  if(typeof body.password!=='string'||!body.password||body.password.length>128)throw new AuthError(400,'이메일과 비밀번호를 입력해 주세요.');
  await limit(db,'login-email:'+email,15);
  const user=await db.prepare('SELECT u.*,c.password_hash FROM app_users u JOIN password_credentials c ON c.user_id=u.id WHERE u.email=?').bind(email).first<Member&{password_hash:string}>();
  if(!await verify(body.password,user?.password_hash||null)||!user)throw new AuthError(401,'이메일 또는 비밀번호가 올바르지 않습니다.');
  if(user.status==='revoked')throw new AuthError(403,'관리자에 의해 접근이 중지된 계정입니다.');
  await db.prepare('DELETE FROM auth_rate_limits WHERE key=?').bind(digest('login-email:'+email)).run();
  const old=token(request);if(old)await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(digest(old)).run();
  return signedIn(db,request,user.id);
 }
 if(action==='logout'&&method==='POST'){
  const old=token(request);if(old)await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(digest(old)).run();
  return reply({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
 }
 if(action==='password'&&method==='POST'){
  const member=await authenticatedMember(db,request);if(!member)throw new AuthError(401,'로그인이 필요합니다.');
  await limit(db,'password:'+member.id,10);const next=validatePassword(body.newPassword),stored=await db.prepare('SELECT password_hash FROM password_credentials WHERE user_id=?').bind(member.id).first<{password_hash:string}>();
  if(typeof body.currentPassword!=='string'||body.currentPassword.length>128||!await verify(body.currentPassword,stored?.password_hash||null))throw new AuthError(401,'현재 비밀번호가 올바르지 않습니다.');
  await db.batch([db.prepare('UPDATE password_credentials SET password_hash=?,updated_at=? WHERE user_id=?').bind(await hashPassword(next),ts(),member.id),db.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(member.id)]);
  return signedIn(db,request,member.id);
 }
 throw new AuthError(405,'지원하지 않는 인증 요청입니다.');
}
