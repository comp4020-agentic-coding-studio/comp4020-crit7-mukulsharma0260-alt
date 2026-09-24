CREATE TABLE `assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`weight` real NOT NULL,
	`weight_provenance` text NOT NULL,
	`weight_source_url` text,
	`due_at` text NOT NULL,
	`due_at_provenance` text NOT NULL,
	`due_at_source_url` text,
	`due_at_published_text` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "weight_published_requires_source_url" CHECK("assessments"."weight_provenance" != 'published' OR "assessments"."weight_source_url" IS NOT NULL),
	CONSTRAINT "due_at_published_requires_source_url" CHECK("assessments"."due_at_provenance" != 'published' OR "assessments"."due_at_source_url" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`code` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`units` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `plan_courses` (
	`course_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action
);
