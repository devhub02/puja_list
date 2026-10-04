CREATE TABLE `preparation` (
	`id` text PRIMARY KEY NOT NULL,
	`puja_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_opened_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `preparation_puja_id_idx` ON `preparation` (`puja_id`);--> statement-breakpoint
CREATE INDEX `preparation_last_opened_at_idx` ON `preparation` (`last_opened_at`);--> statement-breakpoint
CREATE TABLE `vidhi_progress` (
	`preparation_id` text PRIMARY KEY NOT NULL,
	`last_step_number` integer NOT NULL,
	`completed_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`preparation_id`) REFERENCES `preparation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `checklist_progress` RENAME TO `checklist_progress_old`;--> statement-breakpoint
ALTER TABLE `custom_samagri` RENAME TO `custom_samagri_old`;--> statement-breakpoint
INSERT INTO `preparation` (`id`, `puja_id`, `title`, `created_at`, `updated_at`, `last_opened_at`)
SELECT 'prep_migrated_' || `puja_id`, `puja_id`, NULL, MIN(`ts`), MAX(`ts`), MAX(`ts`)
FROM (
	SELECT `puja_id`, `updated_at` AS `ts` FROM `checklist_progress_old`
	UNION ALL
	SELECT `puja_id`, `created_at` AS `ts` FROM `custom_samagri_old`
)
GROUP BY `puja_id`;--> statement-breakpoint
CREATE TABLE `checklist_progress` (
	`preparation_id` text NOT NULL,
	`item_kind` text NOT NULL,
	`item_ref` text NOT NULL,
	`checked` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`preparation_id`, `item_kind`, `item_ref`),
	FOREIGN KEY (`preparation_id`) REFERENCES `preparation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_progress_preparation_id_idx` ON `checklist_progress` (`preparation_id`);--> statement-breakpoint
CREATE TABLE `custom_samagri` (
	`id` text PRIMARY KEY NOT NULL,
	`preparation_id` text NOT NULL,
	`name` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`preparation_id`) REFERENCES `preparation`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_samagri_preparation_id_idx` ON `custom_samagri` (`preparation_id`);--> statement-breakpoint
INSERT INTO `checklist_progress` (`preparation_id`, `item_kind`, `item_ref`, `checked`, `updated_at`)
SELECT 'prep_migrated_' || `puja_id`, `item_kind`, `item_ref`, `checked`, `updated_at`
FROM `checklist_progress_old` WHERE `item_kind` IN ('samagri', 'custom');--> statement-breakpoint
INSERT INTO `custom_samagri` (`id`, `preparation_id`, `name`, `note`, `created_at`)
SELECT `id`, 'prep_migrated_' || `puja_id`, `name`, `note`, `created_at` FROM `custom_samagri_old`;--> statement-breakpoint
DROP TABLE `checklist_progress_old`;--> statement-breakpoint
DROP TABLE `custom_samagri_old`;
