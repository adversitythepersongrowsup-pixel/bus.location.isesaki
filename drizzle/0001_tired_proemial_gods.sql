CREATE TABLE `bus_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`routeId` varchar(128),
	`tripId` varchar(128),
	`latitude` varchar(32) NOT NULL,
	`longitude` varchar(32) NOT NULL,
	`speed` varchar(16),
	`heading` varchar(16),
	`delayMinutes` int DEFAULT 0,
	`currentStopId` varchar(128),
	`nextStopId` varchar(128),
	`status` enum('in_service','out_of_service','delayed','not_started') NOT NULL DEFAULT 'not_started',
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bus_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`callerId` varchar(128) NOT NULL,
	`callerType` enum('admin','tablet') NOT NULL,
	`callerName` varchar(256),
	`receiverId` varchar(128),
	`receiverType` enum('admin','tablet'),
	`status` enum('ringing','active','ended','missed') NOT NULL DEFAULT 'ringing',
	`startedAt` timestamp,
	`endedAt` timestamp,
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128) NOT NULL,
	`deviceName` varchar(256),
	`deviceType` enum('tablet','busloc','admin') NOT NULL DEFAULT 'tablet',
	`routeId` varchar(128),
	`vehicleId` varchar(128),
	`diaId` int,
	`displayMode` enum('normal','simple','night') NOT NULL DEFAULT 'normal',
	`autoStart` boolean NOT NULL DEFAULT false,
	`isOnline` boolean NOT NULL DEFAULT false,
	`lastSyncAt` timestamp,
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `devices_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `dia_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diaId` int NOT NULL,
	`tripId` varchar(128) NOT NULL,
	`stopId` varchar(128) NOT NULL,
	`stopName` text,
	`arrivalTime` varchar(16),
	`departureTime` varchar(16),
	`stopSequence` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dia_segments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diaName` varchar(256) NOT NULL,
	`diaType` enum('weekday','holiday') NOT NULL,
	`routeId` varchar(128),
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` varchar(128) NOT NULL,
	`senderType` enum('admin','tablet') NOT NULL,
	`senderName` varchar(256),
	`receiverId` varchar(128),
	`receiverType` enum('admin','tablet'),
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(128),
	`tripId` varchar(128),
	`routeId` varchar(128),
	`eventType` varchar(64) NOT NULL,
	`eventData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `operation_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeId` varchar(128) NOT NULL,
	`routeShortName` varchar(128),
	`routeLongName` text,
	`routeType` int DEFAULT 3,
	`routeColor` varchar(8),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `routes_id` PRIMARY KEY(`id`),
	CONSTRAINT `routes_routeId_unique` UNIQUE(`routeId`)
);
--> statement-breakpoint
CREATE TABLE `stop_times` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` varchar(128) NOT NULL,
	`stopId` varchar(128) NOT NULL,
	`arrivalTime` varchar(16),
	`departureTime` varchar(16),
	`stopSequence` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stop_times_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stopId` varchar(128) NOT NULL,
	`stopName` text NOT NULL,
	`stopLat` varchar(32),
	`stopLon` varchar(32),
	`stopSequence` int,
	`routeId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stops_id` PRIMARY KEY(`id`),
	CONSTRAINT `stops_stopId_unique` UNIQUE(`stopId`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` varchar(128) NOT NULL,
	`routeId` varchar(128) NOT NULL,
	`serviceId` varchar(128),
	`tripHeadsign` text,
	`directionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trips_id` PRIMARY KEY(`id`),
	CONSTRAINT `trips_tripId_unique` UNIQUE(`tripId`)
);
