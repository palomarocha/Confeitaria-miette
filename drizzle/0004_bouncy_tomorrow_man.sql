CREATE TABLE `bakery_production_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`priority` enum('normal','high') NOT NULL DEFAULT 'normal',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bakery_production_tasks_id` PRIMARY KEY(`id`)
);
