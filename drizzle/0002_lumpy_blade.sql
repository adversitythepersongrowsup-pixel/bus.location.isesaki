CREATE TABLE `device_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`shiftConfirmed` boolean NOT NULL DEFAULT false,
	`shiftConfirmedDate` varchar(16),
	`serviceDate` varchar(16),
	`routeId` varchar(128),
	`diaId` varchar(128),
	`vehicleNo` varchar(128),
	`driverName` varchar(256),
	`latitude` varchar(32),
	`longitude` varchar(32),
	`currentStopId` varchar(128),
	`currentStopName` varchar(256),
	`delayMinutes` int DEFAULT 0,
	`callPhase` varchar(32) DEFAULT 'idle',
	`callId` varchar(128),
	`callBusy` boolean NOT NULL DEFAULT false,
	`lastPassedStopId` varchar(128),
	`lastPassedStopName` varchar(256),
	`lastPassedAt` timestamp,
	`earlyDepartureWarning` boolean NOT NULL DEFAULT false,
	`isOnline` boolean NOT NULL DEFAULT false,
	`lastSeenAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `device_states_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
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
--> statement-breakpoint
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
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` varchar(512) NOT NULL,
	`label` varchar(256) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`unit` varchar(32),
	`valueType` enum('integer','float','string','boolean') NOT NULL DEFAULT 'string',
	`min_value` varchar(32),
	`max_value` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `ui_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(256) NOT NULL,
	`settingValue` text NOT NULL,
	`settingType` varchar(64) NOT NULL DEFAULT 'text',
	`description` varchar(512),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ui_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ui_settings_settingKey_unique` UNIQUE(`settingKey`)
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
ALTER TABLE `dias` ADD `lineId` varchar(128);--> statement-breakpoint
ALTER TABLE `dias` ADD `sortOrder` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `routes` ADD `lineId` varchar(128);--> statement-breakpoint
ALTER TABLE `routes` ADD `isMerged` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `routes` ADD `mergedFrom` text;--> statement-breakpoint
ALTER TABLE `stop_times` ADD `stopHeadsign` varchar(256);