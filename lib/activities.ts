// Durable, participant-scoped activity albums; original demonstration scenes stay separate.
export async function ensureActivities(db:D1Database){
 await db.batch([
  db.prepare(`CREATE TABLE IF NOT EXISTS activity_managers (user_id TEXT PRIMARY KEY REFERENCES app_users(id))`),
  db.prepare(`CREATE TABLE IF NOT EXISTS activity_events (id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, provenance TEXT NOT NULL CHECK(provenance IN ('real','synthetic')), status TEXT NOT NULL CHECK(status IN ('draft','published','withdrawn')), author TEXT NOT NULL, created_at TEXT NOT NULL, request_key TEXT UNIQUE NOT NULL, photo_count INTEGER NOT NULL)`),
  db.prepare(`CREATE TABLE IF NOT EXISTS activity_participants (event_id TEXT NOT NULL REFERENCES activity_events(id), patient_id TEXT NOT NULL REFERENCES patients(id), PRIMARY KEY(event_id,patient_id))`),
  db.prepare(`CREATE TABLE IF NOT EXISTS activity_files (id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES activity_events(id), content_type TEXT NOT NULL, created_at TEXT NOT NULL)`),
 ]);
}
export async function registeredActivities(db:D1Database,patientIds:string[]|null){
 if(patientIds&&!patientIds.length)return [];
 const scope=patientIds?` AND p.patient_id IN (${patientIds.map(()=>'?').join(',')})`:'';
 const rows=await db.prepare(`SELECT f.id AS file_id,p.patient_id,e.id AS event_id,e.title,e.description,e.category,e.date,e.provenance,e.author,e.created_at FROM activity_files f JOIN activity_events e ON e.id=f.event_id JOIN activity_participants p ON p.event_id=e.id WHERE e.status='published'${scope} ORDER BY e.date DESC,e.created_at DESC,f.created_at DESC`).bind(...(patientIds||[])).all<any>();
 return rows.results.map(x=>({id:x.file_id+':'+x.patient_id,patient_id:x.patient_id,asset:'registered-'+x.file_id,event_id:x.event_id,title:x.title,description:x.description,category:x.category,created_at:x.created_at,activity_date:x.date,synthetic:x.provenance==='synthetic',provenance:x.provenance,author:x.author}));
}
export function imageType(bytes:Uint8Array):string|null{
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
