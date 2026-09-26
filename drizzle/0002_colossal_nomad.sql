PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_assessments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`weight` real NOT NULL,
	`weight_provenance` text NOT NULL,
	`weight_source_url` text,
	`due_at` text,
	`due_week` integer,
	`due_timing_status` text NOT NULL,
	`due_at_source_url` text,
	`due_at_published_text` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "weight_published_requires_source_url" CHECK("__new_assessments"."weight_provenance" != 'published' OR "__new_assessments"."weight_source_url" IS NOT NULL),
	CONSTRAINT "due_timing_published_requires_source_url" CHECK("__new_assessments"."due_timing_status" != 'published' OR "__new_assessments"."due_at_source_url" IS NOT NULL),
	CONSTRAINT "due_timing_unstated_is_fully_empty" CHECK("__new_assessments"."due_timing_status" != 'unstated' OR ("__new_assessments"."due_at" IS NULL AND "__new_assessments"."due_week" IS NULL AND "__new_assessments"."due_at_published_text" IS NULL)),
	CONSTRAINT "due_timing_stated_has_something" CHECK("__new_assessments"."due_timing_status" = 'unstated' OR ("__new_assessments"."due_at" IS NOT NULL OR "__new_assessments"."due_week" IS NOT NULL OR "__new_assessments"."due_at_published_text" IS NOT NULL))
);
--> statement-breakpoint
INSERT INTO `__new_assessments`("id", "course_id", "title", "weight", "weight_provenance", "weight_source_url", "due_at", "due_week", "due_timing_status", "due_at_source_url", "due_at_published_text") SELECT "id", "course_id", "title", "weight", "weight_provenance", "weight_source_url", "due_at", NULL, "due_at_provenance", "due_at_source_url", "due_at_published_text" FROM `assessments`;--> statement-breakpoint
DROP TABLE `assessments`;--> statement-breakpoint
ALTER TABLE `__new_assessments` RENAME TO `assessments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `courses` ADD `assessment_scope` text DEFAULT 'complete' NOT NULL;