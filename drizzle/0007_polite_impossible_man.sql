CREATE TABLE `lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lineId` varchar(128) NOT NULL,
	`lineName` varchar(256) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `lines_lineId_unique` UNIQUE(`lineId`)
);
--> statement-breakpoint
ALTER TABLE `routes` ADD `lineId` varchar(128);