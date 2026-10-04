CREATE TABLE `calendar_date` (
	`id` text PRIMARY KEY NOT NULL,
	`festival_id` text NOT NULL,
	`year` integer NOT NULL,
	`date` text NOT NULL,
	`end_date` text,
	`certainty` text NOT NULL,
	`region_note_json` text,
	`source` text NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festival`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calendar_date_festival_year_idx` ON `calendar_date` (`festival_id`,`year`);--> statement-breakpoint
CREATE INDEX `calendar_date_year_date_idx` ON `calendar_date` (`year`,`date`);--> statement-breakpoint
CREATE TABLE `checklist_progress` (
	`puja_id` text NOT NULL,
	`item_ref` text NOT NULL,
	`item_kind` text NOT NULL,
	`checked` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`puja_id`, `item_kind`, `item_ref`)
);
--> statement-breakpoint
CREATE INDEX `checklist_progress_puja_id_idx` ON `checklist_progress` (`puja_id`);--> statement-breakpoint
CREATE TABLE `checklist_template` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text NOT NULL,
	`text_json` text NOT NULL,
	`days_before` integer NOT NULL,
	FOREIGN KEY (`puja_id`) REFERENCES `puja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `checklist_template_puja_id_idx` ON `checklist_template` (`puja_id`);--> statement-breakpoint
CREATE TABLE `content_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `custom_samagri` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `custom_samagri_puja_id_idx` ON `custom_samagri` (`puja_id`);--> statement-breakpoint
CREATE TABLE `festival` (
	`id` text PRIMARY KEY NOT NULL,
	`name_json` text NOT NULL,
	`alt_names_json` text,
	`description_json` text NOT NULL,
	`significance_json` text NOT NULL,
	`regions_json` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `puja` (
	`id` text PRIMARY KEY NOT NULL,
	`festival_id` text,
	`name_json` text NOT NULL,
	`alt_names_json` text,
	`category` text NOT NULL,
	`regions_json` text NOT NULL,
	`summary_json` text NOT NULL,
	`significance_json` text NOT NULL,
	`review_status` text NOT NULL,
	`source_note_json` text NOT NULL,
	`disclaimer_json` text,
	`content_version` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`festival_id`) REFERENCES `festival`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `puja_festival_id_idx` ON `puja` (`festival_id`);--> statement-breakpoint
CREATE INDEX `puja_category_idx` ON `puja` (`category`);--> statement-breakpoint
CREATE INDEX `puja_status_idx` ON `puja` (`status`);--> statement-breakpoint
CREATE TABLE `puja_samagri` (
	`puja_id` text NOT NULL,
	`samagri_id` text NOT NULL,
	`classification` text NOT NULL,
	`purpose_json` text NOT NULL,
	`quantity_guidance_json` text,
	`preparation_note_json` text,
	`regional_note_json` text,
	`sort_order` integer NOT NULL,
	PRIMARY KEY(`puja_id`, `samagri_id`),
	FOREIGN KEY (`puja_id`) REFERENCES `puja`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`samagri_id`) REFERENCES `samagri`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `puja_samagri_puja_sort_idx` ON `puja_samagri` (`puja_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `puja_samagri_samagri_id_idx` ON `puja_samagri` (`samagri_id`);--> statement-breakpoint
CREATE TABLE `recent_search` (
	`query` text PRIMARY KEY NOT NULL,
	`searched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recent_search_searched_at_idx` ON `recent_search` (`searched_at`);--> statement-breakpoint
CREATE TABLE `recent_view` (
	`puja_id` text PRIMARY KEY NOT NULL,
	`viewed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recent_view_viewed_at_idx` ON `recent_view` (`viewed_at`);--> statement-breakpoint
CREATE TABLE `regional_variation` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text NOT NULL,
	`regions_json` text NOT NULL,
	`title_json` text NOT NULL,
	`description_json` text NOT NULL,
	`affects_step_ids_json` text,
	`affects_samagri_ids_json` text,
	FOREIGN KEY (`puja_id`) REFERENCES `puja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `regional_variation_puja_id_idx` ON `regional_variation` (`puja_id`);--> statement-breakpoint
CREATE TABLE `reminder` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text,
	`festival_id` text,
	`title` text NOT NULL,
	`fire_at` integer NOT NULL,
	`notification_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reminder_fire_at_idx` ON `reminder` (`fire_at`);--> statement-breakpoint
CREATE INDEX `reminder_puja_id_idx` ON `reminder` (`puja_id`);--> statement-breakpoint
CREATE TABLE `samagri` (
	`id` text PRIMARY KEY NOT NULL,
	`name_json` text NOT NULL,
	`alt_names_json` text,
	`description_json` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_puja` (
	`puja_id` text PRIMARY KEY NOT NULL,
	`saved_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_puja_saved_at_idx` ON `saved_puja` (`saved_at`);--> statement-breakpoint
CREATE TABLE `vidhi_step` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`title_json` text NOT NULL,
	`description_json` text NOT NULL,
	`related_samagri_ids_json` text NOT NULL,
	`is_optional` integer NOT NULL,
	`important_note_json` text,
	FOREIGN KEY (`puja_id`) REFERENCES `puja`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vidhi_step_puja_step_uq` ON `vidhi_step` (`puja_id`,`step_number`);