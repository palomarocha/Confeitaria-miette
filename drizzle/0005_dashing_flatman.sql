ALTER TABLE `bakery_orders` ADD `trackingCode` varchar(32);--> statement-breakpoint
ALTER TABLE `bakery_orders` ADD CONSTRAINT `bakery_orders_trackingCode_unique` UNIQUE(`trackingCode`);