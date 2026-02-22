CREATE TABLE `device_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`shiftConfirmed` boolean NOT NULL DEFAULT false,
	`shiftConfirmedDate` varchar(32),
	`serviceDate` varchar(32),
	`routeId` varchar(128),
	`diaId` int,
	`vehicleNo` varchar(64),
	`driverName` varchar(256),
	`latitude` varchar(32),
	`longitude` varchar(32),
	`currentStopId` varchar(128),
	`currentStopName` varchar(256),
	`delayMinutes` int DEFAULT 0,
	`callPhase` varchar(32),
	`callId` varchar(128),
	`callBusy` boolean DEFAULT false,
	`isOnline` boolean NOT NULL DEFAULT false,
	`lastSeenAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_states_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `public_arrivals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` varchar(128) NOT NULL,
	`stopId` varchar(128) NOT NULL,
	`stopName` varchar(256),
	`vehicleNo` varchar(64),
	`tripId` varchar(128),
	`estimatedArrival` varchar(16),
	`delayMinutes` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_arrivals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `public_notices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` varchar(128),
	`stopId` varchar(128),
	`noticeType` enum('suspension','delay','detour','notice','other') NOT NULL DEFAULT 'notice',
	`title` varchar(256) NOT NULL,
	`content` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `public_notices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stop_times` ADD `stopHeadsign` varchar(256);