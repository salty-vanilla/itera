CREATE TABLE `activity` (
	`user_id` text NOT NULL,
	`revision` integer NOT NULL,
	`position` integer NOT NULL,
	`at` text NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`user_id`, `revision`, `position`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `actual_time` (
	`sprint_id` text NOT NULL,
	`position` integer NOT NULL,
	`sprint_task_id` text NOT NULL,
	`occurrence_id` text,
	`hours` real NOT NULL,
	`date` text NOT NULL,
	`via` text NOT NULL,
	`recorded_at` text NOT NULL,
	PRIMARY KEY(`sprint_id`, `position`),
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sprint_task_id`) REFERENCES `sprint_task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `actual_time_sprint_task_id_idx` ON `actual_time` (`sprint_task_id`);--> statement-breakpoint
CREATE TABLE `area` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` integer NOT NULL,
	`order` integer NOT NULL,
	`archived` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `area_user_id_idx` ON `area` (`user_id`);--> statement-breakpoint
CREATE TABLE `criterion_use` (
	`sprint_id` text PRIMARY KEY NOT NULL,
	`criterion_id` text NOT NULL,
	`applied_at_confirm` integer NOT NULL,
	`retro_decision` text,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `daily_selection` (
	`id` text PRIMARY KEY NOT NULL,
	`sprint_id` text NOT NULL,
	`position` integer NOT NULL,
	`date` text NOT NULL,
	`sprint_task_id` text NOT NULL,
	`occurrence_id` text,
	`origin` text NOT NULL,
	`resolution` text NOT NULL,
	`selected_at` text NOT NULL,
	`started_at` text,
	`resolved_at` text,
	`closed_before_resolution` text,
	`closed_before_at` text,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sprint_task_id`) REFERENCES `sprint_task`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `daily_selection_sprint_id_idx` ON `daily_selection` (`sprint_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `daily_selection_task_date_idx` ON `daily_selection` (`sprint_task_id`,`date`) WHERE "daily_selection"."occurrence_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `daily_selection_occurrence_date_idx` ON `daily_selection` (`sprint_task_id`,`occurrence_id`,`date`);--> statement-breakpoint
CREATE TABLE `estimate_suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`position` integer NOT NULL,
	`lo` real NOT NULL,
	`hi` real NOT NULL,
	`rationale` text NOT NULL,
	`created_at` text NOT NULL,
	`state` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `estimate_suggestion_task_id_idx` ON `estimate_suggestion` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `estimate_suggestion_presented_idx` ON `estimate_suggestion` (`task_id`) WHERE "estimate_suggestion"."state" = 'presented';--> statement-breakpoint
CREATE TABLE `estimate_suggestion_uncertainty` (
	`suggestion_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`suggestion_id`, `position`),
	FOREIGN KEY (`suggestion_id`) REFERENCES `estimate_suggestion`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interrupt_note` (
	`id` text PRIMARY KEY NOT NULL,
	`sprint_id` text NOT NULL,
	`position` integer NOT NULL,
	`at` text NOT NULL,
	`text` text NOT NULL,
	`minutes` real,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `interrupt_note_sprint_id_idx` ON `interrupt_note` (`sprint_id`);--> statement-breakpoint
CREATE TABLE `occurrence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`rule_version` integer NOT NULL,
	`materialized_at` text NOT NULL,
	`state` text NOT NULL,
	`state_changed_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `occurrence_user_id_idx` ON `occurrence` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `occurrence_rule_date_idx` ON `occurrence` (`rule_id`,`scheduled_date`);--> statement-breakpoint
CREATE TABLE `planning_criterion` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scope_area_id` text,
	`range_policy` text NOT NULL,
	`source_sprint_id` text NOT NULL,
	`state` text NOT NULL,
	`replaced_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `planning_criterion_user_id_idx` ON `planning_criterion` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `planning_criterion_active_idx` ON `planning_criterion` (`user_id`) WHERE "planning_criterion"."state" = 'active';--> statement-breakpoint
CREATE TABLE `record_revision` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "record_revision_positive" CHECK("record_revision"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE `recurrence_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurrence_rule_user_id_idx` ON `recurrence_rule` (`user_id`);--> statement-breakpoint
CREATE TABLE `recurrence_rule_version` (
	`rule_id` text NOT NULL,
	`version` integer NOT NULL,
	`position` integer NOT NULL,
	`freq` text NOT NULL,
	`day_of_month` integer,
	`effective_from` text NOT NULL,
	`effective_to` text,
	PRIMARY KEY(`rule_id`, `version`),
	FOREIGN KEY (`rule_id`) REFERENCES `recurrence_rule`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurrence_rule_version_day` (
	`rule_id` text NOT NULL,
	`version` integer NOT NULL,
	`position` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	PRIMARY KEY(`rule_id`, `version`, `position`),
	FOREIGN KEY (`rule_id`,`version`) REFERENCES `recurrence_rule_version`(`rule_id`,`version`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `retro` (
	`sprint_id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`reflection` text NOT NULL,
	`improvement_text` text,
	`improvement_criterion_id` text,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `retro_pin` (
	`sprint_id` text NOT NULL,
	`position` integer NOT NULL,
	`kind` text NOT NULL,
	`record_id` text,
	PRIMARY KEY(`sprint_id`, `position`),
	FOREIGN KEY (`sprint_id`) REFERENCES `retro`(`sprint_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sprint` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`state` text NOT NULL,
	`previous_sprint_id` text,
	`available_hours` real,
	`planned_available_hours` real,
	`confirmed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sprint_user_start_idx` ON `sprint` (`user_id`,`start`);--> statement-breakpoint
CREATE UNIQUE INDEX `sprint_active_idx` ON `sprint` (`user_id`) WHERE "sprint"."state" = 'active';--> statement-breakpoint
CREATE TABLE `sprint_area_snapshot` (
	`sprint_id` text NOT NULL,
	`area_id` text NOT NULL,
	`position` integer NOT NULL,
	`name` text NOT NULL,
	`order` integer NOT NULL,
	PRIMARY KEY(`sprint_id`, `area_id`),
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sprint_goal` (
	`sprint_id` text NOT NULL,
	`area_id` text NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`planned_text` text,
	`self_assessment` text,
	PRIMARY KEY(`sprint_id`, `area_id`),
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sprint_task` (
	`id` text PRIMARY KEY NOT NULL,
	`sprint_id` text NOT NULL,
	`position` integer NOT NULL,
	`task_id` text NOT NULL,
	`has_occurrences` integer NOT NULL,
	`origin` text NOT NULL,
	`added_at` text NOT NULL,
	`goal_link` text NOT NULL,
	`outcome` text NOT NULL,
	`plan_value_base` text,
	`plan_value_lo` real,
	`plan_value_hi` real,
	`plan_value_unestimated_subtasks` integer,
	`plan_value_criterion_applied` integer,
	`plan_value_computed_at` text,
	`plan_time_basis` text,
	`plan_estimate_hours` real,
	`plan_suggestion_id` text,
	`plan_suggestion_lo` real,
	`plan_suggestion_hi` real,
	`plan_occurrence_count` integer,
	`carried_from` text,
	FOREIGN KEY (`sprint_id`) REFERENCES `sprint`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sprint_task_sprint_id_idx` ON `sprint_task` (`sprint_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sprint_task_once_idx` ON `sprint_task` (`sprint_id`,`task_id`) WHERE "sprint_task"."has_occurrences" = 0;--> statement-breakpoint
CREATE TABLE `sprint_task_occurrence` (
	`sprint_task_id` text NOT NULL,
	`occurrence_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`sprint_task_id`, `occurrence_id`),
	FOREIGN KEY (`sprint_task_id`) REFERENCES `sprint_task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subtask` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`position` integer NOT NULL,
	`title` text NOT NULL,
	`estimate` real,
	`done` integer NOT NULL,
	`done_at` text,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `subtask_task_id_idx` ON `subtask` (`task_id`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`area_id` text,
	`due` text,
	`priority` text NOT NULL,
	`lifecycle` text NOT NULL,
	`time_basis` text NOT NULL,
	`estimate_hours` real,
	`estimate_set_at` text,
	`estimate_source_kind` text,
	`estimate_source_suggestion_id` text,
	`estimate_source_bound` text,
	`recurrence_rule_id` text,
	`created_at` text NOT NULL,
	`created_via` text NOT NULL,
	`completed_at` text,
	`archived_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_user_id_idx` ON `task` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`time_zone` text NOT NULL,
	`week_starts_on` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
