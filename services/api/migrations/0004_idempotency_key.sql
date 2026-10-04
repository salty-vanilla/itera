CREATE TABLE `idempotency_key` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` integer NOT NULL,
	`body` text,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idempotency_key_user_id_created_at_idx` ON `idempotency_key` (`user_id`,`created_at`);