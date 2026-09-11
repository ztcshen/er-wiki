-- Fictional educational schema; not a production migration.
CREATE TABLE `customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `customer_code` VARCHAR(32) NOT NULL COMMENT "客户编号",
  `display_name` VARCHAR(80) NOT NULL COMMENT "显示名称",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customers` (`customer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `sku` VARCHAR(40) NOT NULL COMMENT "SKU",
  `name` VARCHAR(120) NOT NULL COMMENT "商品名称",
  `active` BOOLEAN NOT NULL COMMENT "可销售",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `warehouses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `warehouse_code` VARCHAR(24) NOT NULL COMMENT "仓库编码",
  `name` VARCHAR(80) NOT NULL COMMENT "仓库名称",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouses` (`warehouse_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `inventory` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `warehouse_id` BIGINT UNSIGNED NOT NULL COMMENT "仓库",
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT "商品",
  `on_hand` INT UNSIGNED NOT NULL COMMENT "在库数量",
  `reserved` INT UNSIGNED NOT NULL COMMENT "占用数量",
  `version` INT UNSIGNED NOT NULL COMMENT "并发版本",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory` (`warehouse_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `order_no` VARCHAR(40) NOT NULL COMMENT "订单号",
  `customer_id` BIGINT UNSIGNED NOT NULL COMMENT "客户",
  `status` VARCHAR(24) NOT NULL COMMENT "订单状态",
  `currency` CHAR(3) NOT NULL COMMENT "币种",
  `total_minor` BIGINT UNSIGNED NOT NULL COMMENT "金额最小单位",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_orders` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT "订单",
  `product_id` BIGINT UNSIGNED NOT NULL COMMENT "商品",
  `quantity` INT UNSIGNED NOT NULL COMMENT "下单数量",
  `unit_price_minor` BIGINT UNSIGNED NOT NULL COMMENT "单价最小单位",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `stock_reservations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `order_item_id` BIGINT UNSIGNED NOT NULL COMMENT "订单行",
  `inventory_id` BIGINT UNSIGNED NOT NULL COMMENT "仓库库存",
  `reservation_key` VARCHAR(64) NOT NULL COMMENT "幂等键",
  `quantity` INT UNSIGNED NOT NULL COMMENT "占用数量",
  `status` VARCHAR(24) NOT NULL COMMENT "占用状态",
  `expires_at` DATETIME NOT NULL COMMENT "过期时间",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_reservations` (`reservation_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `fulfillments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT "订单",
  `warehouse_id` BIGINT UNSIGNED NOT NULL COMMENT "出库仓库",
  `fulfillment_no` VARCHAR(40) NOT NULL COMMENT "履约单号",
  `status` VARCHAR(24) NOT NULL COMMENT "履约状态",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fulfillments` (`fulfillment_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `fulfillment_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `fulfillment_id` BIGINT UNSIGNED NOT NULL COMMENT "履约单",
  `order_item_id` BIGINT UNSIGNED NOT NULL COMMENT "订单行",
  `reservation_id` BIGINT UNSIGNED NOT NULL COMMENT "库存占用",
  `quantity` INT UNSIGNED NOT NULL COMMENT "履约数量",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `shipments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `fulfillment_id` BIGINT UNSIGNED NOT NULL COMMENT "履约单",
  `carrier_code` VARCHAR(24) NOT NULL COMMENT "承运商",
  `tracking_no` VARCHAR(64) NOT NULL COMMENT "运单号",
  `status` VARCHAR(24) NOT NULL COMMENT "物流状态",
  `shipped_at` DATETIME NOT NULL COMMENT "发货时间",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `shipment_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `shipment_id` BIGINT UNSIGNED NOT NULL COMMENT "包裹",
  `fulfillment_item_id` BIGINT UNSIGNED NOT NULL COMMENT "履约明细",
  `quantity` INT UNSIGNED NOT NULL COMMENT "发货数量",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `returns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `order_id` BIGINT UNSIGNED NOT NULL COMMENT "原订单",
  `return_no` VARCHAR(40) NOT NULL COMMENT "退货单号",
  `status` VARCHAR(24) NOT NULL COMMENT "退货状态",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_returns` (`return_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `return_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT "标识",
  `return_id` BIGINT UNSIGNED NOT NULL COMMENT "退货单",
  `shipment_item_id` BIGINT UNSIGNED NOT NULL COMMENT "原发货明细",
  `warehouse_id` BIGINT UNSIGNED NOT NULL COMMENT "退货接收仓库",
  `quantity` INT UNSIGNED NOT NULL COMMENT "退货数量",
  `disposition` VARCHAR(24) NOT NULL COMMENT "处置方式",
  `created_at` DATETIME NOT NULL COMMENT "创建时间",
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `inventory` ADD CONSTRAINT `fk_inventory_warehouse_id` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);
ALTER TABLE `inventory` ADD CONSTRAINT `fk_inventory_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`);
ALTER TABLE `order_items` ADD CONSTRAINT `fk_order_items_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);
ALTER TABLE `order_items` ADD CONSTRAINT `fk_order_items_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);
ALTER TABLE `stock_reservations` ADD CONSTRAINT `fk_stock_reservations_order_item_id` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`);
ALTER TABLE `stock_reservations` ADD CONSTRAINT `fk_stock_reservations_inventory_id` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`id`);
ALTER TABLE `fulfillments` ADD CONSTRAINT `fk_fulfillments_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);
ALTER TABLE `fulfillments` ADD CONSTRAINT `fk_fulfillments_warehouse_id` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);
ALTER TABLE `fulfillment_items` ADD CONSTRAINT `fk_fulfillment_items_fulfillment_id` FOREIGN KEY (`fulfillment_id`) REFERENCES `fulfillments` (`id`);
ALTER TABLE `fulfillment_items` ADD CONSTRAINT `fk_fulfillment_items_order_item_id` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`);
ALTER TABLE `fulfillment_items` ADD CONSTRAINT `fk_fulfillment_items_reservation_id` FOREIGN KEY (`reservation_id`) REFERENCES `stock_reservations` (`id`);
ALTER TABLE `shipments` ADD CONSTRAINT `fk_shipments_fulfillment_id` FOREIGN KEY (`fulfillment_id`) REFERENCES `fulfillments` (`id`);
ALTER TABLE `shipment_items` ADD CONSTRAINT `fk_shipment_items_shipment_id` FOREIGN KEY (`shipment_id`) REFERENCES `shipments` (`id`);
ALTER TABLE `shipment_items` ADD CONSTRAINT `fk_shipment_items_fulfillment_item_id` FOREIGN KEY (`fulfillment_item_id`) REFERENCES `fulfillment_items` (`id`);
ALTER TABLE `returns` ADD CONSTRAINT `fk_returns_order_id` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`);
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_items_return_id` FOREIGN KEY (`return_id`) REFERENCES `returns` (`id`);
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_items_shipment_item_id` FOREIGN KEY (`shipment_item_id`) REFERENCES `shipment_items` (`id`);
ALTER TABLE `return_items` ADD CONSTRAINT `fk_return_items_warehouse_id` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);
