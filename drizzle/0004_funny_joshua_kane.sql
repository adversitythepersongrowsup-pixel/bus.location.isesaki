CREATE TABLE `public_arrivals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` varchar(128) NOT NULL,
	`routeShortName` varchar(128),
	`stopId` varchar(128) NOT NULL,
	`stopName` varchar(256) NOT NULL,
	`arrivals` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_arrivals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` varchar(128),
	`stopId` varchar(128),
	`noticeType` enum('info','delay','cancel','detour','other') NOT NULL DEFAULT 'info',
	`title` varchar(256) NOT NULL,
	`content` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdBy` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_notices_id` PRIMARY KEY(`id`)
);
