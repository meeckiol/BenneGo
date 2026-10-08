CREATE TABLE `driver_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','active','suspended') NOT NULL DEFAULT 'pending',
	`truckType` varchar(80),
	`truckPlate` varchar(32),
	`capacityM3` decimal(7,2),
	`isAvailable` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `driver_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `driver_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `job_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`eventType` varchar(48) NOT NULL,
	`requestId` varchar(64) NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_events_requestId_unique` UNIQUE(`requestId`)
);
--> statement-breakpoint
CREATE TABLE `job_locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`driverProfileId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(40) NOT NULL,
	`clientName` varchar(140) NOT NULL,
	`pickupAddress` text NOT NULL,
	`deliveryAddress` text NOT NULL,
	`pickupLatitude` decimal(10,7),
	`pickupLongitude` decimal(10,7),
	`deliveryLatitude` decimal(10,7),
	`deliveryLongitude` decimal(10,7),
	`materialDescription` varchar(180) NOT NULL,
	`quantityM3` decimal(7,2) NOT NULL,
	`driverEarnings` int NOT NULL,
	`status` enum('offered','accepted','en_route_pickup','loading','en_route_delivery','delivered','validated','cancelled') NOT NULL DEFAULT 'offered',
	`driverProfileId` int,
	`acceptedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `jobs_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `driver_profiles` ADD CONSTRAINT `driver_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_events` ADD CONSTRAINT `job_events_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_events` ADD CONSTRAINT `job_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_locations` ADD CONSTRAINT `job_locations_jobId_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `job_locations` ADD CONSTRAINT `job_locations_driverProfileId_driver_profiles_id_fk` FOREIGN KEY (`driverProfileId`) REFERENCES `driver_profiles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `jobs` ADD CONSTRAINT `jobs_driverProfileId_driver_profiles_id_fk` FOREIGN KEY (`driverProfileId`) REFERENCES `driver_profiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `driver_profiles_status_idx` ON `driver_profiles` (`status`);--> statement-breakpoint
CREATE INDEX `job_events_job_idx` ON `job_events` (`jobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `job_locations_job_recorded_idx` ON `job_locations` (`jobId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_driver_status_idx` ON `jobs` (`driverProfileId`,`status`);