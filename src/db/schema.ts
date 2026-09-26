import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Users & Roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name').notNull().default(''),
  role: text('role').notNull().default('staff'), // 'manager' | 'staff'
  avatarUrl: text('avatar_url'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false),
  assignedWarehouseId: integer('assigned_warehouse_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Warehouses
export const warehouses = pgTable('warehouses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Locations (Zones, Racks, Bins within Warehouse)
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  name: text('name').notNull(), // e.g. "Rack A-01-B"
  code: text('code').notNull(), // Barcode / QR identifier
  zone: text('zone').notNull().default('Main'),
  type: text('type').notNull().default('storage'), // 'receiving', 'storage', 'picking', 'shipping'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 4. Product Categories
export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 5. Products
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode').notNull().unique(),
  categoryId: integer('category_id').references(() => productCategories.id),
  unitOfMeasure: text('unit_of_measure').notNull().default('units'), // 'units', 'boxes', 'kg', 'liters', 'pallets'
  unitsPerBox: integer('units_per_box').default(1).notNull(),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  sellingPrice: numeric('selling_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  reorderThreshold: integer('reorder_threshold').notNull().default(10),
  trackBatchExpiry: boolean('track_batch_expiry').notNull().default(false),
  description: text('description').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('products_sku_idx').on(table.sku),
  index('products_barcode_idx').on(table.barcode),
]);

// 6. Batches / Lots
export const batches = pgTable('batches', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  batchNo: text('batch_no').notNull(),
  expiryDate: timestamp('expiry_date'),
  manufacturingDate: timestamp('manufacturing_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 7. Stock Levels (Inventory balance per product, location, and optional batch)
export const stockLevels = pgTable('stock_levels', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  batchId: integer('batch_id').references(() => batches.id),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('stock_levels_product_location_idx').on(table.productId, table.locationId),
  index('stock_levels_warehouse_idx').on(table.warehouseId),
]);

// 8. Suppliers
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  contactName: text('contact_name').default(''),
  email: text('email').default(''),
  phone: text('phone').default(''),
  leadTimeDays: integer('lead_time_days').default(3).notNull(),
  address: text('address').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 9. Purchase Orders
export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  poNumber: text('po_number').notNull().unique(), // e.g. "PO-2026-001"
  supplierId: integer('supplier_id').notNull().references(() => suppliers.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  status: text('status').notNull().default('Draft'), // 'Draft', 'Sent', 'Partially Received', 'Received', 'Canceled'
  notes: text('notes').default(''),
  createdById: integer('created_by_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Purchase Order Lines
export const poLines = pgTable('po_lines', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  quantityOrdered: integer('quantity_ordered').notNull(),
  quantityReceived: integer('quantity_received').notNull().default(0),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0.00'),
  autoSuggested: boolean('auto_suggested').default(false).notNull(),
  suggestedQty: integer('suggested_qty'),
});

// 11. Receipts (Inbound Operations)
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  receiptNumber: text('receipt_number').notNull().unique(), // e.g. "REC-2026-001"
  poId: integer('po_id').references(() => purchaseOrders.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  status: text('status').notNull().default('Ready'), // 'Draft', 'Waiting', 'Ready', 'Done', 'Canceled'
  sourceDocument: text('source_document').default(''),
  receivedById: integer('received_by_id').references(() => users.id),
  validatedAt: timestamp('validated_at'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 12. Receipt Lines
export const receiptLines = pgTable('receipt_lines', {
  id: serial('id').primaryKey(),
  receiptId: integer('receipt_id').notNull().references(() => receipts.id),
  productId: integer('product_id').notNull().references(() => products.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  batchNo: text('batch_no'),
  expiryDate: timestamp('expiry_date'),
  expectedQty: integer('expected_qty').notNull().default(0),
  receivedQty: integer('received_qty').notNull().default(0),
});

// 13. Delivery Orders (Outbound Operations)
export const deliveryOrders = pgTable('delivery_orders', {
  id: serial('id').primaryKey(),
  doNumber: text('do_number').notNull().unique(), // e.g. "DO-2026-001"
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  customerName: text('customer_name').notNull().default('Retail Customer'),
  shippingAddress: text('shipping_address').default(''),
  assignedStaffId: integer('assigned_staff_id').references(() => users.id),
  status: text('status').notNull().default('Ready'), // 'Draft', 'Waiting', 'Ready', 'Done', 'Canceled'
  validatedAt: timestamp('validated_at'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 14. Delivery Order Lines
export const deliveryLines = pgTable('delivery_lines', {
  id: serial('id').primaryKey(),
  deliveryId: integer('delivery_id').notNull().references(() => deliveryOrders.id),
  productId: integer('product_id').notNull().references(() => products.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  orderedQty: integer('ordered_qty').notNull(),
  pickedQty: integer('picked_qty').notNull().default(0),
  isOutOfStockFlagged: boolean('is_out_of_stock_flagged').default(false).notNull(),
});

// 15. Internal Transfers
export const internalTransfers = pgTable('internal_transfers', {
  id: serial('id').primaryKey(),
  transferNumber: text('transfer_number').notNull().unique(), // e.g. "TRF-2026-001"
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  fromLocationId: integer('from_location_id').notNull().references(() => locations.id),
  toLocationId: integer('to_location_id').notNull().references(() => locations.id),
  status: text('status').notNull().default('Ready'), // 'Draft', 'Waiting', 'Ready', 'Done', 'Canceled'
  initiatedById: integer('initiated_by_id').notNull().references(() => users.id),
  completedById: integer('completed_by_id').references(() => users.id),
  validatedAt: timestamp('validated_at'),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 16. Internal Transfer Lines
export const transferLines = pgTable('transfer_lines', {
  id: serial('id').primaryKey(),
  transferId: integer('transfer_id').notNull().references(() => internalTransfers.id),
  productId: integer('product_id').notNull().references(() => products.id),
  batchId: integer('batch_id').references(() => batches.id),
  quantity: integer('quantity').notNull(),
});

// 17. Stock Adjustments (Stock Count & Physical Variance)
export const stockAdjustments = pgTable('stock_adjustments', {
  id: serial('id').primaryKey(),
  adjustmentNumber: text('adjustment_number').notNull().unique(), // e.g. "ADJ-2026-001"
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  status: text('status').notNull().default('Waiting'), // 'Draft', 'Waiting', 'Done', 'Canceled'
  reason: text('reason').notNull(), // 'Annual Audit', 'Damaged', 'Loss/Theft', 'Expired', 'Cycle Count'
  staffComment: text('staff_comment').default(''),
  managerComment: text('manager_comment').default(''),
  submittedById: integer('submitted_by_id').notNull().references(() => users.id),
  reviewedById: integer('reviewed_by_id').references(() => users.id),
  validatedAt: timestamp('validated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Stock Adjustment Lines
export const adjustmentLines = pgTable('adjustment_lines', {
  id: serial('id').primaryKey(),
  adjustmentId: integer('adjustment_id').notNull().references(() => stockAdjustments.id),
  productId: integer('product_id').notNull().references(() => products.id),
  recordedQty: integer('recorded_qty').notNull(),
  countedQty: integer('counted_qty').notNull(),
  varianceQty: integer('variance_qty').notNull(), // countedQty - recordedQty
});

// 19. Stock Ledger (Unified Immutable Movement Log)
export const stockLedger = pgTable('stock_ledger', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => products.id),
  warehouseId: integer('warehouse_id').notNull().references(() => warehouses.id),
  locationId: integer('location_id').notNull().references(() => locations.id),
  batchId: integer('batch_id').references(() => batches.id),
  movementType: text('movement_type').notNull(), // 'RECEIPT', 'DELIVERY', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN'
  documentType: text('document_type').notNull(), // 'PO', 'RECEIPT', 'DO', 'TRANSFER', 'ADJUSTMENT'
  documentReference: text('document_reference').notNull(),
  quantityChange: integer('quantity_change').notNull(), // e.g. +50 or -20
  newBalance: integer('new_balance').notNull(),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).default('0.00'),
  performedById: integer('performed_by_id').references(() => users.id),
  notes: text('notes').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('stock_ledger_product_created_idx').on(table.productId, table.createdAt),
  index('stock_ledger_created_at_idx').on(table.createdAt),
]);

// 20. Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id), // null means broadcast / all relevant managers
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'), // 'low_stock', 'out_of_stock', 'approval_pending', 'expiry_alert', 'po_status', 'task_assigned'
  targetRole: text('target_role'), // 'manager', 'staff', 'all'
  targetUserId: integer('target_user_id').references(() => users.id),
  targetWarehouseId: integer('target_warehouse_id').references(() => warehouses.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedById: integer('acknowledged_by_id').references(() => users.id),
  actionUrl: text('action_url').default(''),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 21. Document Comments (Two-way staff & manager document notes)
export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  documentType: text('document_type').notNull(), // 'receipt', 'delivery', 'transfer', 'adjustment'
  documentId: text('document_id').notNull(), // e.g. "REC-2026-0001", "DO-2026-0001"
  authorId: integer('author_id').notNull().references(() => users.id),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 22. Audit Log (System-wide trace of creates, updates, deletes)
export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'VALIDATE'
  entityType: text('entity_type').notNull(), // 'product', 'purchase_order', 'receipt', 'delivery', 'transfer', 'adjustment', 'warehouse', 'user'
  entityId: text('entity_id').notNull(),
  details: text('details').default(''), // JSON string of diff or summary
  ipAddress: text('ip_address').default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('audit_log_created_at_idx').on(table.createdAt),
  index('audit_log_user_id_idx').on(table.userId),
]);

// Drizzle Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  assignedWarehouse: one(warehouses, {
    fields: [users.assignedWarehouseId],
    references: [warehouses.id],
  }),
  auditLogs: many(auditLog),
  notifications: many(notifications),
}));

export const warehousesRelations = relations(warehouses, ({ many }) => ({
  locations: many(locations),
  stockLevels: many(stockLevels),
}));

export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  stockLevels: many(stockLevels),
  batches: many(batches),
  ledgerEntries: many(stockLedger),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [locations.warehouseId],
    references: [warehouses.id],
  }),
  stockLevels: many(stockLevels),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  stockLevels: many(stockLevels),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  product: one(products, {
    fields: [stockLevels.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockLevels.warehouseId],
    references: [warehouses.id],
  }),
  location: one(locations, {
    fields: [stockLevels.locationId],
    references: [locations.id],
  }),
  batch: one(batches, {
    fields: [stockLevels.batchId],
    references: [batches.id],
  }),
}));

export const stockLedgerRelations = relations(stockLedger, ({ one }) => ({
  product: one(products, {
    fields: [stockLedger.productId],
    references: [products.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockLedger.warehouseId],
    references: [warehouses.id],
  }),
  location: one(locations, {
    fields: [stockLedger.locationId],
    references: [locations.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
