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
