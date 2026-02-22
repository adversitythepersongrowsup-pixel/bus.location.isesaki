CREATE TABLE `quick_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` varchar(256) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quick_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `device_states` ADD `lastPassedStopId` varchar(128);--> statement-breakpoint
ALTER TABLE `device_states` ADD `lastPassedStopName` varchar(256);--> statement-breakpoint
ALTER TABLE `device_states` ADD `lastPassedAt` timestamp;--> statement-breakpoint
ALTER TABLE `device_states` ADD `earlyDepartureWarning` boolean DEFAULT false NOT NULL;