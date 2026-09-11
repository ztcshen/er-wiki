# Fictional e-commerce fulfillment

This is a schema-only example authored for ER Wiki. It is not a production
architecture, a copy of another commerce product's database, or a company export.

## Reading order

1. `products`, `warehouses`, `inventory`: an SKU may be stocked in several warehouses.
2. `orders`, `order_items`, `stock_reservations`: reserve quantities at specific stock locations.
3. `fulfillments`, `fulfillment_items`: split the order into warehouse work.
4. `shipments`, `shipment_items`: pack some or all fulfillment items into parcels.
5. `returns`, `return_items`: refer to shipped items and distinguish restock,
   quarantine and scrap. Returns are not automatically payment refunds.

The demo illustrates partial fulfillment and multiple warehouses through explicit
line-level relationships. Its DDL intentionally does not implement every necessary
application invariant: quantity conservation, idempotent state transitions,
same-order consistency and concurrent stock allocation need implementation.

`reviewEnumValues` in JSON are editor annotations, not executable SQL enums.
The database statements are illustrative and must not be run in an existing
business database. No INSERT statements or personal records are included.

Regenerate the JSON, DDL and static preview after setup with `npm run demo`.
The default install adds the demo once and never overwrites a user's edited copy.
