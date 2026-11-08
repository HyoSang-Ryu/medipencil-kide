import { seed } from './seed';
// Explicit, approved synthetic-data test fixtures requested by the Site owner.
// One-time installation; never resets passwords, reactivates users, or restores removed links.
const fixtures=[
  {
    "id": "demo-doctor-v1",
    "email": "doctor@demo.test",
    "name": "테스트 의료진",
    "role": "staff",
    "hash": "scrypt$32768$8$3$1390e8e6c67c8e1cf919547237826ba7$2b1cb6783f7d12e3c5c2c0bda449e70439aa577e8d28bb46c9f2416c449713eb"
  },
  {
    "id": "demo-family-v1",
    "email": "family@demo.test",
    "name": "테스트 보호자",
    "role": "family",
    "hash": "scrypt$32768$8$3$4a0627e7ff5852987202bdc7c52de1dc$680dca608518af8cd75f5b09dcdff6868c0ae18f122e0dc45fbf340e76ea24d8"
  }
];
const installation='approved-test-accounts-v1';
let installing:Promise<void>|undefined;
export async function ensureTestAccounts(db:D1Database){
 if(!installing)installing=(async()=>{await install(db);await installAdmin(db)})().catch(e=>{installing=undefined;throw e});
 await installing;
}
async function install(db:D1Database){
 if(await db.prepare('SELECT key FROM seed_installations WHERE key=?').bind(installation).first())return;
 await seed(db);const now=new Date().toISOString(),statements:D1PreparedStatement[]=[];
 for(const f of fixtures){
  statements.push(db.prepare("INSERT OR IGNORE INTO app_users (id,email,name,role,status,created_at,updated_at) SELECT ?,?,?,?,'active',?,? WHERE NOT EXISTS (SELECT 1 FROM seed_installations WHERE key=?)").bind(f.id,f.email,f.name,f.role,now,now,installation));
  statements.push(db.prepare("INSERT OR IGNORE INTO password_credentials (user_id,password_hash,created_at,updated_at) SELECT id,?,?,? FROM app_users WHERE id=? AND email=? AND NOT EXISTS (SELECT 1 FROM seed_installations WHERE key=?)").bind(f.hash,now,now,f.id,f.email,installation));
  if(f.role==='family')statements.push(db.prepare("INSERT OR IGNORE INTO family_links (id,user_id,patient_id) SELECT 'demo-family-p1-v1',id,'p1' FROM app_users WHERE id=? AND email=? AND NOT EXISTS (SELECT 1 FROM seed_installations WHERE key=?)").bind(f.id,f.email,installation));
 }
 statements.push(db.prepare('INSERT OR IGNORE INTO seed_installations (key,applied_at) VALUES (?,?)').bind(installation,now));
 await db.batch(statements);
}

// A separately versioned, explicitly requested administrator fixture.
// Existing owner/admin accounts and their credentials are never changed.
async function installAdmin(db:D1Database){
 const key='approved-admin-test-account-v1';
 if(await db.prepare('SELECT key FROM seed_installations WHERE key=?').bind(key).first())return;
 const id='demo-admin-v1',email='admin@demo.test',now=new Date().toISOString();
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO app_users (id,email,name,role,status,created_at,updated_at) SELECT ?,?,'테스트 관리자','admin','active',?,? WHERE NOT EXISTS (SELECT 1 FROM seed_installations WHERE key=?)").bind(id,email,now,now,key),
  db.prepare("INSERT OR IGNORE INTO password_credentials (user_id,password_hash,created_at,updated_at) SELECT id,?,?,? FROM app_users WHERE id=? AND email=? AND role='admin' AND NOT EXISTS (SELECT 1 FROM seed_installations WHERE key=?)").bind("scrypt$32768$8$3$87cf325e36f2088c648249c2fc0fdb8e$ff49de93408554947d134ab870fd260a1a5de7bd95de0fb6e1809bb6b4a35bc6",now,now,id,email,key),
  db.prepare('INSERT OR IGNORE INTO seed_installations (key,applied_at) VALUES (?,?)').bind(key,now)
 ]);
}
