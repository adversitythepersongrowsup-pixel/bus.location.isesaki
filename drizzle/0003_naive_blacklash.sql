CREATE TABLE `drivers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverName` varchar(256) NOT NULL,
	`driverCode` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
	CONSTRAINT `drivers_driverCode_unique` UNIQUE(`driverCode`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleNumber` varchar(128) NOT NULL,
	`vehicleName` varchar(256),
	`capacity` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_vehicleNumber_unique` UNIQUE(`vehicleNumber`)
);
--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `shiftConfirmedDate` varchar(16);--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `serviceDate` varchar(16);--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `diaId` varchar(128);--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `vehicleNo` varchar(128);--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `callPhase` varchar(32) DEFAULT 'idle';--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `callBusy` boolean NOT NULL;--> statement-breakpoint
ALTER TABLE `device_states` MODIFY COLUMN `lastSeenAt` timestamp;--> statement-breakpoint
ALTER TABLE `public_arrivals` MODIFY COLUMN `stopName` varchar(256) NOT NULL;--> statement-breakpoint
ALTER TABLE `public_notices` MODIFY COLUMN `noticeType` enum('info','delay','cancel','detour','other') NOT NULL DEFAULT 'info';--> statement-breakpoint
ALTER TABLE `public_notices` MODIFY COLUMN `content` text NOT NULL;--> statement-breakpoint
ALTER TABLE `dias` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `public_arrivals` ADD `routeShortName` varchar(128);--> statement-breakpoint
ALTER TABLE `public_arrivals` ADD `arrivals` json NOT NULL;--> statement-breakpoint
ALTER TABLE `public_notices` ADD `createdBy` varchar(128);--> statement-breakpoint
ALTER TABLE `public_arrivals` DROP COLUMN `vehicleNo`;--> statement-breakpoint
ALTER TABLE `public_arrivals` DROP COLUMN `tripId`;--> statement-breakpoint
ALTER TABLE `public_arrivals` DROP COLUMN `estimatedArrival`;--> statement-breakpoint
ALTER TABLE `public_arrivals` DROP COLUMN `delayMinutes`;