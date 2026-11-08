import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const patients = sqliteTable('patients', {
 id:text('id').primaryKey(),name:text('name').notNull(),age:integer('age').notNull(),sex:text('sex').notNull(),room:text('room').notNull(),diagnosis:text('diagnosis').notNull(),doctor:text('doctor').notNull(),nurse:text('nurse').notNull(),guardian:text('guardian').notNull(),status:text('status').notNull()
});
export const sessions = sqliteTable('demo_sessions',{
 tokenHash:text('token_hash').primaryKey(),viewerId:text('viewer_id').notNull(),persona:text('persona').notNull(),expiresAt:text('expires_at').notNull()
});
export const logs = sqliteTable('care_logs',{
 id:text('id').primaryKey(),patientId:text('patient_id').notNull().references(()=>patients.id),category:text('category').notNull(),note:text('note').notNull(),temperature:real('temperature'),systolic:integer('systolic'),diastolic:integer('diastolic'),glucose:integer('glucose'),meal:integer('meal'),rehab:integer('rehab'),status:text('status').notNull(),author:text('author').notNull(),createdAt:text('created_at').notNull(),idempotencyKey:text('idempotency_key').unique()
});
export const messages = sqliteTable('messages',{
 id:text('id').primaryKey(),patientId:text('patient_id').notNull().references(()=>patients.id),kind:text('kind').notNull(),senderRole:text('sender_role').notNull(),senderName:text('sender_name').notNull(),body:text('body').notNull(),createdAt:text('created_at').notNull(),idempotencyKey:text('idempotency_key').unique()
});
export const readReceipts = sqliteTable('message_reads',{
 id:text('id').primaryKey(),messageId:text('message_id').notNull().references(()=>messages.id),persona:text('persona').notNull(),readAt:text('read_at').notNull()
},t=>[uniqueIndex('read_per_persona').on(t.messageId,t.persona)]);
export const bookings = sqliteTable('bookings',{
 id:text('id').primaryKey(),patientId:text('patient_id').notNull().references(()=>patients.id),type:text('type').notNull(),date:text('date').notNull(),time:text('time').notNull(),visitors:integer('visitors').notNull(),status:text('status').notNull(),requestedBy:text('requested_by').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),idempotencyKey:text('idempotency_key').unique()
},t=>[uniqueIndex('active_patient_slot').on(t.patientId,t.date,t.time).where(sql`${t.status} in ('pending','approved')`)]);
export const audit = sqliteTable('audit_events',{
 id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),entityId:text('entity_id').notNull(),createdAt:text('created_at').notNull()
});
export const appUsers = sqliteTable('app_users',{
 id:text('id').primaryKey(),authUserId:text('auth_user_id').unique(),email:text('email').notNull().unique(),name:text('name').notNull(),role:text('role').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
});
export const familyLinks = sqliteTable('family_links',{
 id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>appUsers.id),patientId:text('patient_id').notNull().references(()=>patients.id)
},t=>[uniqueIndex('family_user_patient').on(t.userId,t.patientId)]);
export const accessRequests = sqliteTable('access_requests',{
 id:text('id').primaryKey(),authUserId:text('auth_user_id').notNull().unique(),email:text('email').notNull(),name:text('name').notNull(),requestedRole:text('requested_role').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull()
});
export const passwordCredentials = sqliteTable('password_credentials',{
 userId:text('user_id').primaryKey().references(()=>appUsers.id),passwordHash:text('password_hash').notNull(),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
});
export const authSessions = sqliteTable('auth_sessions',{
 tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>appUsers.id),createdAt:text('created_at').notNull(),expiresAt:text('expires_at').notNull()
});
export const authRateLimits = sqliteTable('auth_rate_limits',{
 key:text('key').primaryKey(),hits:integer('hits').notNull(),resetAt:integer('reset_at').notNull()
});
export const adminSetupGrants = sqliteTable('admin_setup_grants',{
 tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>appUsers.id),expiresAt:text('expires_at').notNull()
});
export const seedInstallations = sqliteTable('seed_installations',{
 key:text('key').primaryKey(),appliedAt:text('applied_at').notNull()
});
export const activityManagers=sqliteTable('activity_managers',{
 userId:text('user_id').primaryKey().references(()=>appUsers.id)
});
export const activityEvents=sqliteTable('activity_events',{
 id:text('id').primaryKey(),name:text('name').notNull(),date:text('date').notNull(),category:text('category').notNull(),title:text('title').notNull(),description:text('description').notNull(),provenance:text('provenance').notNull(),status:text('status').notNull(),author:text('author').notNull(),createdAt:text('created_at').notNull(),requestKey:text('request_key').unique().notNull(),photoCount:integer('photo_count').notNull()
});
export const activityParticipants=sqliteTable('activity_participants',{
 eventId:text('event_id').notNull().references(()=>activityEvents.id),patientId:text('patient_id').notNull().references(()=>patients.id)
},t=>[uniqueIndex('activity_participant').on(t.eventId,t.patientId)]);
export const activityFiles=sqliteTable('activity_files',{
 id:text('id').primaryKey(),eventId:text('event_id').notNull().references(()=>activityEvents.id),contentType:text('content_type').notNull(),createdAt:text('created_at').notNull()
});
