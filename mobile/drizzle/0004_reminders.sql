-- Hand-written (the generated SQL adds NOT NULL columns without defaults, which SQLite rejects).
-- The Phase 2 `reminder` table was never written by any code (reminders arrive in Phase 6C), and its rows
-- could not belong to a preparation, so it is replaced by the new shape. No other table is touched:
-- saved_puja, preparation, checklist_progress, custom_samagri, vidhi_progress, recent_view, recent_search
-- and every content table keep all their rows.
DROP INDEX `reminder_fire_at_idx`;--> statement-breakpoint
DROP INDEX `reminder_puja_id_idx`;--> statement-breakpoint
DROP TABLE `reminder`;--> statement-breakpoint
CREATE TABLE `reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`preparation_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`notification_id` text,
	`label` text,
	`paused_reason` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`preparation_id`) REFERENCES `preparation`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_preparation_time_uq` ON `reminder` (`preparation_id`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `reminder_scheduled_at_idx` ON `reminder` (`scheduled_at`);
