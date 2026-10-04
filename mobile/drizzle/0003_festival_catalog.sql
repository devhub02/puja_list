-- Hand-edited after `drizzle-kit generate` (same approach as 0002): the generated SQL copied columns that do
-- not exist in the old `festival` table (`short_description_json`, `category`, ...), which fails on a database
-- that has rows. Content tables are disposable (docs/DB_SCHEMA.md section 7): they are emptied here and
-- `content_meta` is deleted, so the seed loader refills them from the bundled content.json on the next start.
-- No user-data table is touched: saved_puja, preparation, checklist_progress, custom_samagri, vidhi_progress,
-- reminder, recent_view and recent_search keep every row.
DELETE FROM `search_index`;--> statement-breakpoint
DELETE FROM `puja_samagri`;--> statement-breakpoint
DELETE FROM `vidhi_step`;--> statement-breakpoint
DELETE FROM `regional_variation`;--> statement-breakpoint
DELETE FROM `checklist_template`;--> statement-breakpoint
DELETE FROM `calendar_date`;--> statement-breakpoint
DELETE FROM `puja`;--> statement-breakpoint
DELETE FROM `samagri`;--> statement-breakpoint
DELETE FROM `festival`;--> statement-breakpoint
DELETE FROM `content_meta`;--> statement-breakpoint
DROP TABLE `festival`;--> statement-breakpoint
CREATE TABLE `festival` (
	`id` text PRIMARY KEY NOT NULL,
	`name_json` text NOT NULL,
	`alt_names_json` text,
	`short_description_json` text NOT NULL,
	`significance_json` text,
	`regions_json` text NOT NULL,
	`states_json` text,
	`category` text NOT NULL,
	`date_type` text NOT NULL,
	`observance_json` text,
	`linked_puja_ids_json` text DEFAULT '[]' NOT NULL,
	`review_status` text NOT NULL,
	`source_note_json` text NOT NULL,
	`status` text NOT NULL
);--> statement-breakpoint
ALTER TABLE `calendar_date` ADD `region` text DEFAULT 'all' NOT NULL;
