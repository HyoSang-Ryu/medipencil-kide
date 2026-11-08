CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`visitors` integer NOT NULL,
	`status` text NOT NULL,
	`requested_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`idempotency_key` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_idempotency_key_unique` ON `bookings` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `active_patient_slot` ON `bookings` (`patient_id`,`date`,`time`) WHERE "bookings"."status" in ('pending','approved');--> statement-breakpoint
CREATE TABLE `care_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`temperature` real,
	`systolic` integer,
	`diastolic` integer,
	`glucose` integer,
	`meal` integer,
	`rehab` integer,
	`status` text NOT NULL,
	`author` text NOT NULL,
	`created_at` text NOT NULL,
	`idempotency_key` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `care_logs_idempotency_key_unique` ON `care_logs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`sender_role` text NOT NULL,
	`sender_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`idempotency_key` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_idempotency_key_unique` ON `messages` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`room` text NOT NULL,
	`diagnosis` text NOT NULL,
	`doctor` text NOT NULL,
	`nurse` text NOT NULL,
	`guardian` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`persona` text NOT NULL,
	`read_at` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `read_per_persona` ON `message_reads` (`message_id`,`persona`);--> statement-breakpoint
CREATE TABLE `demo_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`viewer_id` text NOT NULL,
	`persona` text NOT NULL,
	`expires_at` text NOT NULL
);
