ALTER TABLE `dias` ADD `lineId` varchar(128);--> statement-breakpoint
ALTER TABLE `routes` ADD `isMerged` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `routes` ADD `mergedFrom` text;