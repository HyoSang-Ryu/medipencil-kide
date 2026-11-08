import {ensureActivities} from './activities';
export type Member={id:string;auth_user_id:string|null;email:string;name:string;role:string;status:string;created_at:string;updated_at:string};
export async function resolveAccount(db:D1Database,member:Member){
 await ensureActivities(db);
 if(member.status!=='active')return {actor:null,member};
 const linked=member.role==='family'?(await db.prepare('SELECT patient_id FROM family_links WHERE user_id=? ORDER BY patient_id').bind(member.id).all<{patient_id:string}>()).results.map(x=>x.patient_id):[];
 if(member.role==='family'&&!linked.length)return {actor:null,member:{...member,status:'awaiting_family'}};
 return {member,actor:{role:member.role==='family'?'family':'staff',isAdmin:member.role==='admin',canManageActivities:member.role==='admin'||(member.role==='staff'&&!!await db.prepare('SELECT user_id FROM activity_managers WHERE user_id=?').bind(member.id).first()),name:member.name,email:member.email,userId:member.id,persona:member.id,patientId:linked[0]||null,patientIds:linked}};
}
