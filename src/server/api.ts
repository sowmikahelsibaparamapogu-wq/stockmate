import express from 'express';
import { db } from '../db/index.ts';
import {
  products,
  productCategories,
  stockLevels,
  warehouses,
  locations,
  suppliers,
  purchaseOrders,
  poLines,
  receipts,
  receiptLines,
  deliveryOrders,
  deliveryLines,
  internalTransfers,
  transferLines,
  stockAdjustments,
  adjustmentLines,
  stockLedger,
  batches,
  notifications,
  comments,
  auditLog,
  users,
} from '../db/schema.ts';
import { eq, desc, sql, and, gte, inArray } from 'drizzle-orm';
import { requireAuth, requireRole, type AuthRequest } from '../middleware/auth.ts';
import { resetAndSeedDemoDatabase } from '../db/seed.ts';

export const apiRouter = express.Router();

// Helper to send targeted notifications to warehouse-scoped staff
export async function createTargetedStaffNotification({
  title,
  message,
  type = 'task_assigned',
  warehouseId,
  actionUrl = '',
}: {
  title: string;
  message: string;
  type?: string;
  warehouseId?: number;
  actionUrl?: string;
}) {
  let targetUserId: number | null = null;
  let targetWarehouseId: number | null = warehouseId ? Number(warehouseId) : null;

  if (targetWarehouseId) {
    const assignedStaff = await db
      .select()
      .from(users)
      .where(and(eq(users.role, 'staff'), eq(users.assignedWarehouseId, targetWarehouseId)));
    if (assignedStaff.length > 0) {
      if (assignedStaff.length === 1) {
        targetUserId = assignedStaff[0].id;
      }
    } else {
      // Fallback to targetRole: 'staff' broadcast only if no staff are assigned to that warehouse
      targetWarehouseId = null;
      targetUserId = null;
    }
  }

  await db.insert(notifications).values({
    title,
    message,
    type,
    targetRole: 'staff',
    targetUserId,
    targetWarehouseId,
    actionUrl,
  });
}

// Helper to record audit log
export async function createAudit(
  userId: number | undefined,
  action: string,
  entityType: string,
  entityId: string,
  details: any
) {
  try {
    await db.insert(auditLog).values({
      userId: userId || null,
      action,
      entityType,
      entityId,
      details: typeof details === 'string' ? details : JSON.stringify(details),
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// ----------------------------------------------------------------------
// DEMO DATA MANAGEMENT & TEST RUNNERS
// ----------------------------------------------------------------------
apiRouter.post('/demo/reset', requireAuth, async (req: AuthRequest, res) => {
  try {
    await resetAndSeedDemoDatabase();
    await createAudit(req.dbUser?.id, 'RESET_DEMO_DATA', 'database', 'DEMO_DATASET', {
      triggeredBy: req.dbUser?.email,
      timestamp: new Date().toISOString(),
    });
    res.json({
      success: true,
      message: 'Demo dataset successfully refreshed with all operational scenarios (Receipts, DOs, Transfers, Adjustments, and Stock).',
    });
  } catch (err: any) {
    console.error('Error resetting demo database:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// USER & PROFILE
// ----------------------------------------------------------------------
apiRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({
      user: req.dbUser,
      firebase: {
        uid: req.user?.uid,
        email: req.user?.email,
        name: req.user?.name,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Switch role (for demo / management switching) or update profile
apiRouter.patch('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { name, role, twoFactorEnabled, assignedWarehouseId } = req.body;
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized' });

    const updated = await db
      .update(users)
      .set({
        name: name !== undefined ? name : req.dbUser.name,
        role: role !== undefined ? role : req.dbUser.role,
        twoFactorEnabled: twoFactorEnabled !== undefined ? twoFactorEnabled : req.dbUser.twoFactorEnabled,
        assignedWarehouseId: assignedWarehouseId !== undefined ? assignedWarehouseId : req.dbUser.assignedWarehouseId,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.dbUser.id))
      .returning();

    await createAudit(req.dbUser.id, 'UPDATE', 'user', String(req.dbUser.id), { role, name });
    res.json(updated[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// DASHBOARD & ANALYTICS
// ----------------------------------------------------------------------
apiRouter.get('/dashboard/kpis', requireAuth, async (req: AuthRequest, res) => {
  try {
    // 1. Total stock count
    const stockSumResult = await db
      .select({ totalUnits: sql<number>`COALESCE(SUM(quantity), 0)` })
      .from(stockLevels);
    const totalUnits = Number(stockSumResult[0]?.totalUnits || 0);

    // 2. Fetch all products with their current stock, open orders, and reorder thresholds
    const allProducts = await db.select().from(products);
    const currentStockLevels = await db
      .select({
        productId: stockLevels.productId,
        totalQty: sql<number>`COALESCE(SUM(quantity), 0)`,
      })
      .from(stockLevels)
      .groupBy(stockLevels.productId);

    const stockMap = new Map<number, number>();
    for (const row of currentStockLevels) {
      if (row.productId) stockMap.set(row.productId, Number(row.totalQty));
    }

    // Query active purchase orders for each product
    const openPoLines = await db
      .select({
        productId: poLines.productId,
        orderedQty: sql<number>`COALESCE(SUM(${poLines.quantityOrdered} - ${poLines.quantityReceived}), 0)`,
        poNumber: sql<string>`MAX(${purchaseOrders.poNumber})`,
        poStatus: sql<string>`MAX(${purchaseOrders.status})`,
        poId: sql<number>`MAX(${purchaseOrders.id})`,
      })
      .from(poLines)
      .innerJoin(purchaseOrders, eq(poLines.poId, purchaseOrders.id))
      .where(inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received']))
      .groupBy(poLines.productId);

    const openOrdersMap = new Map<
      number,
      { orderedQty: number; poNumber: string; poStatus: string; poId: number }
    >();
    for (const row of openPoLines) {
      if (row.productId && Number(row.orderedQty) > 0) {
        openOrdersMap.set(row.productId, {
          orderedQty: Number(row.orderedQty),
          poNumber: row.poNumber,
          poStatus: row.poStatus,
          poId: Number(row.poId),
        });
      }
    }

    let outOfStockCount = 0;
    let lowStockCount = 0;
    let onOrderCount = 0;
    const outOfStockItems: any[] = [];
    const lowStockItems: any[] = [];
    const orderedInboundItems: any[] = [];

    for (const p of allProducts) {
      const stock = stockMap.get(p.id) || 0;
      const openOrder = openOrdersMap.get(p.id);

      if (openOrder) {
        // Product has already been ordered! Moved to inbound staff receiving list and removed from urgent reorder list
        onOrderCount++;
        orderedInboundItems.push({
          ...p,
          currentStock: stock,
          openPoNumber: openOrder.poNumber,
          openPoId: openOrder.poId,
          pendingInboundQty: openOrder.orderedQty,
          poStatus: openOrder.poStatus,
          assignedQueue: 'Staff Receiving Dock',
        });
      } else if (stock === 0) {
        outOfStockCount++;
        outOfStockItems.push({ ...p, currentStock: stock });
      } else if (stock <= p.reorderThreshold) {
        lowStockCount++;
        lowStockItems.push({ ...p, currentStock: stock });
      }
    }

    // 3. Pending Operations
    const [pendingReceipts] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(receipts)
      .where(inArray(receipts.status, ['Ready', 'Waiting', 'Draft']));

    const [pendingDeliveries] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(deliveryOrders)
      .where(inArray(deliveryOrders.status, ['Ready', 'Waiting', 'Draft']));

    const [scheduledTransfers] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(internalTransfers)
      .where(inArray(internalTransfers.status, ['Ready', 'Waiting']));

    const [pendingApprovals] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(stockAdjustments)
      .where(eq(stockAdjustments.status, 'Waiting'));

    // 4. Movement Trends (last 14 days)
    const recentMovements = await db
      .select({
        date: sql<string>`TO_CHAR(created_at, 'YYYY-MM-DD')`,
        movementType: stockLedger.movementType,
        totalQty: sql<number>`SUM(ABS(quantity_change))`,
      })
      .from(stockLedger)
      .groupBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD')`, stockLedger.movementType)
      .orderBy(sql`TO_CHAR(created_at, 'YYYY-MM-DD') ASC`)
      .limit(30);

    // 5. Top Moving & Slow/Dead Products
    const movementCounts = await db
      .select({
        productId: stockLedger.productId,
        totalMoved: sql<number>`SUM(ABS(quantity_change))`,
      })
      .from(stockLedger)
      .groupBy(stockLedger.productId)
      .orderBy(desc(sql`SUM(ABS(quantity_change))`));

    const topProductIds = movementCounts.slice(0, 5).map(m => m.productId);
    const topProducts = allProducts.filter(p => topProductIds.includes(p.id));

    // Slow or dead products: low stock velocity
    const deadStock = allProducts.filter(p => !movementCounts.some(m => m.productId === p.id && Number(m.totalMoved) > 5));

    res.json({
      kpis: {
        totalStock: totalUnits,
        outOfStockCount,
        lowStockCount,
        onOrderCount,
        pendingReceipts: Number(pendingReceipts?.count || 0),
        pendingDeliveries: Number(pendingDeliveries?.count || 0),
        scheduledTransfers: Number(scheduledTransfers?.count || 0),
        pendingApprovals: Number(pendingApprovals?.count || 0),
      },
      outOfStockItems,
      lowStockItems,
      orderedInboundItems,
      recentMovements,
      topProducts,
      deadStock,
    });
  } catch (err: any) {
    console.error('KPI error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// PRODUCTS & CATEGORIES
// ----------------------------------------------------------------------
apiRouter.get('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const list = await db.query.products.findMany({
      with: {
        category: true,
        stockLevels: true,
        batches: true,
      },
      orderBy: [desc(products.id)],
    });

    // Query active purchase orders for all products
    const openPoLines = await db
      .select({
        productId: poLines.productId,
        orderedQty: sql<number>`COALESCE(SUM(${poLines.quantityOrdered} - ${poLines.quantityReceived}), 0)`,
        poNumber: sql<string>`MAX(${purchaseOrders.poNumber})`,
        poStatus: sql<string>`MAX(${purchaseOrders.status})`,
      })
      .from(poLines)
      .innerJoin(purchaseOrders, eq(poLines.poId, purchaseOrders.id))
      .where(inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received']))
      .groupBy(poLines.productId);

    const openOrdersMap = new Map<number, { orderedQty: number; poNumber: string; poStatus: string }>();
    for (const row of openPoLines) {
      if (row.productId && Number(row.orderedQty) > 0) {
        openOrdersMap.set(row.productId, {
          orderedQty: Number(row.orderedQty),
          poNumber: row.poNumber,
          poStatus: row.poStatus,
        });
      }
    }

    // Compute aggregated live stock and attach inbound order status
    const formatted = list.map(item => {
      const totalStock = item.stockLevels.reduce((acc, curr) => acc + curr.quantity, 0);
      const isLowStock = totalStock <= item.reorderThreshold && totalStock > 0;
      const isOutOfStock = totalStock === 0;
      const openOrder = openOrdersMap.get(item.id);

      return {
        ...item,
        totalStock,
        openOrder: openOrder || null,
        pendingInboundQty: openOrder?.orderedQty || 0,
        status: isOutOfStock ? 'OUT_OF_STOCK' : isLowStock ? 'LOW_STOCK' : 'IN_STOCK',
      };
    });

    res.json(formatted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/products', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const {
      name,
      sku,
      barcode,
      categoryId,
      unitOfMeasure,
      unitsPerBox,
      costPrice,
      sellingPrice,
      reorderThreshold,
      trackBatchExpiry,
      description,
      initialStock,
      warehouseId,
      locationId,
    } = req.body;

    if (!name || !sku || !barcode) {
      return res.status(400).json({ error: 'Name, SKU, and Barcode are required.' });
    }

    // Check for duplicate SKU or Barcode
    const existing = await db.query.products.findFirst({
      where: sql`sku = ${sku} OR barcode = ${barcode}`,
    });
    if (existing) {
      if (existing.sku.toLowerCase() === sku.toLowerCase()) {
        return res.status(400).json({ error: `Product SKU "${sku}" already exists in inventory.` });
      }
      return res.status(400).json({ error: `Barcode "${barcode}" already belongs to item "${existing.name}".` });
    }

    const [newProduct] = await db
      .insert(products)
      .values({
        name,
        sku,
        barcode,
        categoryId: categoryId ? Number(categoryId) : null,
        unitOfMeasure: unitOfMeasure || 'units',
        unitsPerBox: Number(unitsPerBox) || 1,
        costPrice: String(costPrice || '0.00'),
        sellingPrice: String(sellingPrice || '0.00'),
        reorderThreshold: Number(reorderThreshold) || 10,
        trackBatchExpiry: Boolean(trackBatchExpiry),
        description: description || '',
      })
      .returning();

    // If initial stock was provided, create stock level and ledger entry
    const openingStock = Number(initialStock) || 0;
    if (openingStock > 0) {
      let whId = warehouseId ? Number(warehouseId) : null;
      let locId = locationId ? Number(locationId) : null;

      if (!whId || !locId) {
        const defaultWh = await db.query.warehouses.findFirst({ with: { locations: true } });
        if (defaultWh) {
          whId = defaultWh.id;
          locId = defaultWh.locations?.[0]?.id || 1;
        }
      }

      if (whId && locId) {
        await db.insert(stockLevels).values({
          productId: newProduct.id,
          warehouseId: whId,
          locationId: locId,
          quantity: openingStock,
        });

        await db.insert(stockLedger).values({
          productId: newProduct.id,
          warehouseId: whId,
          locationId: locId,
          movementType: 'RECEIPT',
          documentType: 'INITIAL_STOCK',
          documentReference: `INIT-${newProduct.sku}`,
          quantityChange: openingStock,
          newBalance: openingStock,
          unitCost: newProduct.costPrice,
          performedById: req.dbUser?.id,
          notes: 'Initial opening stock balance recorded upon product creation.',
        });
      }
    }

    await createAudit(req.dbUser?.id, 'CREATE', 'product', String(newProduct.id), newProduct);

    res.status(201).json(newProduct);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/products/:id', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const {
      name,
      sku,
      barcode,
      categoryId,
      unitOfMeasure,
      unitsPerBox,
      costPrice,
      sellingPrice,
      reorderThreshold,
      trackBatchExpiry,
      description,
    } = req.body;

    const [updated] = await db
      .update(products)
      .set({
        name,
        sku,
        barcode,
        categoryId: categoryId ? Number(categoryId) : null,
        unitOfMeasure,
        unitsPerBox: Number(unitsPerBox) || 1,
        costPrice: String(costPrice || '0.00'),
        sellingPrice: String(sellingPrice || '0.00'),
        reorderThreshold: Number(reorderThreshold) || 10,
        trackBatchExpiry: Boolean(trackBatchExpiry),
        description: description || '',
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId))
      .returning();

    await createAudit(req.dbUser?.id, 'UPDATE', 'product', String(productId), updated);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/products/:id', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    // Delete stock levels first
    await db.delete(stockLevels).where(eq(stockLevels.productId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await createAudit(req.dbUser?.id, 'DELETE', 'product', String(productId), { id: productId });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Bulk Import for Products
apiRouter.post('/products/bulk-import', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { items } = req.body; // Array of product objects
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for import' });
    }

    const imported = [];
    for (const item of items) {
      const [inserted] = await db.insert(products).values({
        name: item.name,
        sku: item.sku,
        barcode: item.barcode || `${Date.now()}-${Math.floor(Math.random()*1000)}`,
        unitOfMeasure: item.unitOfMeasure || 'units',
        unitsPerBox: Number(item.unitsPerBox) || 1,
        costPrice: String(item.costPrice || '0.00'),
        sellingPrice: String(item.sellingPrice || '0.00'),
        reorderThreshold: Number(item.reorderThreshold) || 10,
        description: item.description || '',
      }).returning();
      imported.push(inserted);
    }

    await createAudit(req.dbUser?.id, 'CREATE', 'product', 'bulk_import', { count: imported.length });
    res.json({ count: imported.length, imported });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Categories CRUD
apiRouter.get('/categories', requireAuth, async (req, res) => {
  try {
    const cats = await db.select().from(productCategories).orderBy(productCategories.name);
    res.json(cats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/categories', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const [inserted] = await db.insert(productCategories).values({ name, description }).returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// AUTO-SUGGESTED REORDER QUANTITY ENGINE
// Dedicated endpoint: GET /api/v1/products/{id}/reorder-suggestion
// Formula: (Reorder Threshold * Safety Margin + Daily Burn Rate * Supplier Lead Days) - (Current Stock + Open PO Inbound)
// ----------------------------------------------------------------------
apiRouter.get('/products/:id/reorder-suggestion', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // 1. Current stock across all warehouses
    const stockResults = await db
      .select({ current: sql<number>`COALESCE(SUM(${stockLevels.quantity}), 0)` })
      .from(stockLevels)
      .where(eq(stockLevels.productId, productId));
    const currentStock = Number(stockResults[0]?.current || 0);

    // 2. Open POs (Sent or Partially Received)
    const openPoLines = await db
      .select({
        ordered: sql<number>`COALESCE(SUM(${poLines.quantityOrdered} - ${poLines.quantityReceived}), 0)`,
      })
      .from(poLines)
      .innerJoin(purchaseOrders, eq(poLines.poId, purchaseOrders.id))
      .where(
        and(
          eq(poLines.productId, productId),
          inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received'])
        )
      );
    const pendingInbound = Number(openPoLines[0]?.ordered || 0);

    // 3. Average recent usage rate (from stockLedger past 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const usageResults = await db
      .select({
        used: sql<number>`COALESCE(SUM(ABS(${stockLedger.quantityChange})), 0)`,
      })
      .from(stockLedger)
      .where(
        and(
          eq(stockLedger.productId, productId),
          inArray(stockLedger.movementType, ['DELIVERY', 'TRANSFER_OUT', 'ADJUSTMENT_OUT']),
          gte(stockLedger.createdAt, thirtyDaysAgo)
        )
      );
    const thirtyDayUsage = Number(usageResults[0]?.used || 0);
    const dailyBurnRate = Math.max(thirtyDayUsage / 30, 0.5); // minimum 0.5 unit/day estimate

    // 4. Default lead time estimate (e.g. 5 days)
    const estimatedLeadDays = 5;
    const safetyBuffer = 1.25;

    // Formula calculation:
    // Desired Target = (reorderThreshold * safetyBuffer) + (dailyBurnRate * estimatedLeadDays)
    // Suggested Order = max(0, Desired Target - currentStock - pendingInbound)
    const desiredTarget = Math.ceil(product.reorderThreshold * safetyBuffer + dailyBurnRate * estimatedLeadDays);
    const rawSuggested = desiredTarget - currentStock - pendingInbound;
    const suggestedQuantity = Math.max(0, Math.ceil(rawSuggested));

    res.json({
      productId,
      productName: product.name,
      sku: product.sku,
      currentStock,
      reorderThreshold: product.reorderThreshold,
      pendingInbound,
      dailyBurnRate: parseFloat(dailyBurnRate.toFixed(2)),
      estimatedLeadDays,
      suggestedQuantity: suggestedQuantity > 0 ? suggestedQuantity : product.reorderThreshold,
      explanation: `Calculated from threshold (${product.reorderThreshold}), stock (${currentStock}), open POs (${pendingInbound}), and burn rate (${dailyBurnRate.toFixed(1)}/day). Fully editable.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// SUPPLIERS & PURCHASE ORDERS
// ----------------------------------------------------------------------
apiRouter.get('/suppliers', requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(suppliers).orderBy(suppliers.name);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/suppliers', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { name, code, contactName, email, phone, leadTimeDays, address } = req.body;
    const [inserted] = await db
      .insert(suppliers)
      .values({
        name,
        code,
        contactName: contactName || '',
        email: email || '',
        phone: phone || '',
        leadTimeDays: Number(leadTimeDays) || 3,
        address: address || '',
      })
      .returning();
    await createAudit(req.dbUser?.id, 'CREATE', 'supplier', String(inserted.id), inserted);
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const pos = await db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.id));
    const lines = await db
      .select({
        line: poLines,
        product: products,
      })
      .from(poLines)
      .leftJoin(products, eq(poLines.productId, products.id));

    const supList = await db.select().from(suppliers);
    const whList = await db.select().from(warehouses);
    const receiptsList = await db.select().from(receipts);

    const result = pos.map(po => {
      const orderLines = lines.filter(l => l.line.poId === po.id).map(l => ({
        ...l.line,
        product: l.product,
      }));
      const supplier = supList.find(s => s.id === po.supplierId);
      const warehouse = whList.find(w => w.id === po.warehouseId);
      const linkedReceipt = receiptsList.find(r => r.poId === po.id);
      return {
        ...po,
        supplier,
        warehouse,
        lines: orderLines,
        linkedReceipt: linkedReceipt || null,
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/purchase-orders', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { supplierId, warehouseId, notes, lines } = req.body;
    if (!supplierId || !warehouseId || !lines || lines.length === 0) {
      return res.status(400).json({ error: 'Supplier, Warehouse, and at least one item line are required' });
    }

    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [createdPo] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId: Number(supplierId),
        warehouseId: Number(warehouseId),
        status: 'Sent',
        notes: notes || '',
        createdById: req.dbUser!.id,
      })
      .returning();

    for (const line of lines) {
      await db.insert(poLines).values({
        poId: createdPo.id,
        productId: Number(line.productId),
        quantityOrdered: Number(line.quantityOrdered),
        quantityReceived: 0,
        unitPrice: String(line.unitPrice || '0.00'),
        autoSuggested: Boolean(line.autoSuggested),
        suggestedQty: line.suggestedQty ? Number(line.suggestedQty) : null,
      });
    }

    // Auto-create a linked Receipt document in "Ready" status for Warehouse Staff
    const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [createdReceipt] = await db
      .insert(receipts)
      .values({
        receiptNumber,
        poId: createdPo.id,
        warehouseId: Number(warehouseId),
        status: 'Ready',
        sourceDocument: poNumber,
        notes: `Linked to ${poNumber}`,
      })
      .returning();

    // Default receiving location (first storage or receiving location for that warehouse)
    const whLocs = await db.select().from(locations).where(eq(locations.warehouseId, Number(warehouseId)));
    const targetLoc = whLocs.find(l => l.type === 'receiving') || whLocs[0];

    if (targetLoc) {
      for (const line of lines) {
        await db.insert(receiptLines).values({
          receiptId: createdReceipt.id,
          productId: Number(line.productId),
          locationId: targetLoc.id,
          expectedQty: Number(line.quantityOrdered),
          receivedQty: 0,
        });
      }
    }

    // Notify Warehouse Staff scoped to target warehouse
    await createTargetedStaffNotification({
      title: `Inbound Shipment Ready: ${receiptNumber}`,
      message: `Purchase Order ${poNumber} has been issued. Staff can inspect and receive stock under Receipt ${receiptNumber}.`,
      type: 'task_assigned',
      warehouseId: Number(warehouseId),
      actionUrl: '/staff/receipts',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'purchase_order', poNumber, { poNumber, linesCount: lines.length });

    res.status(201).json({ purchaseOrder: createdPo, linkedReceipt: createdReceipt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// 1-CLICK INSTANT AUTO-REORDER ENGINE
// Dedicated endpoint: POST /api/v1/purchase-orders/auto-reorder
// ----------------------------------------------------------------------
apiRouter.post('/purchase-orders/auto-reorder', requireAuth, requireRole(['manager', 'staff']), async (req: AuthRequest, res) => {
  try {
    const { productId, sku, warehouseId: userWhId, quantity: customQty } = req.body;

    let product;
    if (productId) {
      product = await db.query.products.findFirst({ where: eq(products.id, Number(productId)) });
    } else if (sku) {
      product = await db.query.products.findFirst({ where: eq(products.sku, String(sku)) });
    }

    if (!product) {
      return res.status(404).json({ error: 'Product not found for auto-reorder' });
    }

    // Determine target warehouse
    let targetWhId = userWhId ? Number(userWhId) : req.dbUser?.assignedWarehouseId;
    if (!targetWhId) {
      const allWhs = await db.select().from(warehouses).limit(1);
      targetWhId = allWhs[0]?.id;
    }
    if (!targetWhId) {
      return res.status(400).json({ error: 'No warehouse available to receive order' });
    }

    // Determine supplier
    const allSuppliers = await db.select().from(suppliers).limit(1);
    const supplierId = allSuppliers[0]?.id;
    if (!supplierId) {
      return res.status(400).json({ error: 'No suppliers registered in system' });
    }

    // Compute suggestion or use customQty
    let orderQuantity = customQty ? Number(customQty) : 0;
    if (!orderQuantity || orderQuantity <= 0) {
      const stockResults = await db
        .select({ current: sql<number>`COALESCE(SUM(${stockLevels.quantity}), 0)` })
        .from(stockLevels)
        .where(eq(stockLevels.productId, product.id));
      const currentStock = Number(stockResults[0]?.current || 0);

      const openPoLines = await db
        .select({
          ordered: sql<number>`COALESCE(SUM(${poLines.quantityOrdered} - ${poLines.quantityReceived}), 0)`,
        })
        .from(poLines)
        .innerJoin(purchaseOrders, eq(poLines.poId, purchaseOrders.id))
        .where(
          and(
            eq(poLines.productId, product.id),
            inArray(purchaseOrders.status, ['Draft', 'Sent', 'Partially Received'])
          )
        );
      const pendingInbound = Number(openPoLines[0]?.ordered || 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const usageResults = await db
        .select({ used: sql<number>`COALESCE(SUM(ABS(${stockLedger.quantityChange})), 0)` })
        .from(stockLedger)
        .where(
          and(
            eq(stockLedger.productId, product.id),
            inArray(stockLedger.movementType, ['DELIVERY', 'TRANSFER_OUT', 'ADJUSTMENT_OUT']),
            gte(stockLedger.createdAt, thirtyDaysAgo)
          )
        );
      const thirtyDayUsage = Number(usageResults[0]?.used || 0);
      const dailyBurnRate = Math.max(thirtyDayUsage / 30, 0.5);
      const desiredTarget = Math.ceil(product.reorderThreshold * 1.25 + dailyBurnRate * 5);
      const rawSuggested = desiredTarget - currentStock - pendingInbound;
      orderQuantity = Math.max(product.reorderThreshold, Math.ceil(rawSuggested));
    }

    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [createdPo] = await db
      .insert(purchaseOrders)
      .values({
        poNumber,
        supplierId,
        warehouseId: targetWhId,
        status: 'Sent',
        notes: `1-Click Auto-Replenishment for depleted item: ${product.name} (${product.sku})`,
        createdById: req.dbUser!.id,
      })
      .returning();

    await db.insert(poLines).values({
      poId: createdPo.id,
      productId: product.id,
      quantityOrdered: orderQuantity,
      quantityReceived: 0,
      unitPrice: product.costPrice || '10.00',
      autoSuggested: true,
      suggestedQty: orderQuantity,
    });

    const receiptNumber = `REC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const [createdReceipt] = await db
      .insert(receipts)
      .values({
        receiptNumber,
        poId: createdPo.id,
        warehouseId: targetWhId,
        status: 'Ready',
        sourceDocument: poNumber,
        notes: `Auto-linked to ${poNumber}`,
      })
      .returning();

    const whLocs = await db.select().from(locations).where(eq(locations.warehouseId, targetWhId));
    const targetLoc = whLocs.find(l => l.type === 'receiving') || whLocs[0];

    if (targetLoc) {
      await db.insert(receiptLines).values({
        receiptId: createdReceipt.id,
        productId: product.id,
        locationId: targetLoc.id,
        expectedQty: orderQuantity,
        receivedQty: 0,
      });
    }

    await createTargetedStaffNotification({
      title: `⚡ Auto-Order Executed: ${poNumber}`,
      message: `Automatic reorder for ${product.name} (${product.sku}) issued: ${orderQuantity} ${product.unitOfMeasure}. Inbound Receipt ${receiptNumber} created on dock.`,
      type: 'task_assigned',
      warehouseId: targetWhId,
      actionUrl: '/staff/receipts',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'purchase_order', poNumber, {
      autoReorder: true,
      productId: product.id,
      quantity: orderQuantity,
    });

    res.status(201).json({
      success: true,
      purchaseOrder: createdPo,
      linkedReceipt: createdReceipt,
      suggestedQuantity: orderQuantity,
      productName: product.name,
      sku: product.sku,
    });
  } catch (err: any) {
    console.error('Auto-reorder error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// OPERATIONS: RECEIPTS (INBOUND)
// ----------------------------------------------------------------------
apiRouter.get('/receipts', requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(receipts).orderBy(desc(receipts.id));
    const whs = await db.select().from(warehouses);
    const rLines = await db
      .select({
        line: receiptLines,
        product: products,
        location: locations,
      })
      .from(receiptLines)
      .innerJoin(products, eq(receiptLines.productId, products.id))
      .innerJoin(locations, eq(receiptLines.locationId, locations.id));

    const result = list.map(rec => ({
      ...rec,
      warehouse: whs.find(w => w.id === rec.warehouseId),
      lines: rLines.filter(l => l.line.receiptId === rec.id).map(l => ({
        ...l.line,
        product: l.product,
        location: l.location,
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate Receipt -> Stock +, Unified Ledger Entry, Optional Batch capture
apiRouter.post('/receipts/:id/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const receiptId = Number(req.params.id);
    const { lineUpdates } = req.body; // [{ id, receivedQty, locationId, batchNo, expiryDate }]

    const receipt = await db.query.receipts.findFirst({
      where: eq(receipts.id, receiptId),
    });
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    if (receipt.status === 'Done') return res.status(400).json({ error: 'Receipt already validated' });

    const existingLines = await db.select().from(receiptLines).where(eq(receiptLines.receiptId, receiptId));

    // Update lines and stock
    for (const update of lineUpdates || []) {
      const line = existingLines.find(l => l.id === update.id);
      if (!line) continue;

      const qty = Number(update.receivedQty ?? line.receivedQty);
      const locId = Number(update.locationId ?? line.locationId);

      await db
        .update(receiptLines)
        .set({
          receivedQty: qty,
          locationId: locId,
          batchNo: update.batchNo || line.batchNo,
          expiryDate: update.expiryDate ? new Date(update.expiryDate) : line.expiryDate,
        })
        .where(eq(receiptLines.id, line.id));

      if (qty > 0) {
        // Handle batch creation if batchNo provided
        let batchId: number | null = null;
        if (update.batchNo) {
          const [batchRecord] = await db
            .insert(batches)
            .values({
              productId: line.productId,
              batchNo: update.batchNo,
              expiryDate: update.expiryDate ? new Date(update.expiryDate) : null,
            })
            .returning();
          batchId = batchRecord.id;
        }

        // Increment or insert Stock Level
        const [existingStock] = await db
          .select()
          .from(stockLevels)
          .where(
            and(
              eq(stockLevels.productId, line.productId),
              eq(stockLevels.warehouseId, receipt.warehouseId),
              eq(stockLevels.locationId, locId)
            )
          );

        let newStockBalance = qty;
        if (existingStock) {
          newStockBalance = existingStock.quantity + qty;
          await db
            .update(stockLevels)
            .set({ quantity: newStockBalance, updatedAt: new Date() })
            .where(eq(stockLevels.id, existingStock.id));
        } else {
          await db.insert(stockLevels).values({
            productId: line.productId,
            warehouseId: receipt.warehouseId,
            locationId: locId,
            batchId,
            quantity: qty,
          });
        }

        // Ledger Entry
        await db.insert(stockLedger).values({
          productId: line.productId,
          warehouseId: receipt.warehouseId,
          locationId: locId,
          batchId,
          movementType: 'RECEIPT',
          documentType: 'RECEIPT',
          documentReference: receipt.receiptNumber,
          quantityChange: qty,
          newBalance: newStockBalance,
          performedById: req.dbUser?.id,
          notes: `Goods received via ${receipt.receiptNumber}`,
        });

        // Update corresponding PO line if linked
        if (receipt.poId) {
          const [poLine] = await db
            .select()
            .from(poLines)
            .where(and(eq(poLines.poId, receipt.poId), eq(poLines.productId, line.productId)));
          if (poLine) {
            await db
              .update(poLines)
              .set({ quantityReceived: poLine.quantityReceived + qty })
              .where(eq(poLines.id, poLine.id));
          }
        }
      }
    }

    // Mark Receipt Done
    await db
      .update(receipts)
      .set({
        status: 'Done',
        receivedById: req.dbUser?.id,
        validatedAt: new Date(),
      })
      .where(eq(receipts.id, receiptId));

    // If PO linked, update status to Received or Partially Received
    if (receipt.poId) {
      const allPoLines = await db.select().from(poLines).where(eq(poLines.poId, receipt.poId));
      const allReceived = allPoLines.every(l => l.quantityReceived >= l.quantityOrdered);
      await db
        .update(purchaseOrders)
        .set({ status: allReceived ? 'Received' : 'Partially Received' })
        .where(eq(purchaseOrders.id, receipt.poId));
    }

    await createAudit(req.dbUser?.id, 'VALIDATE', 'receipt', receipt.receiptNumber, { receiptId });

    res.json({ success: true, message: `Receipt ${receipt.receiptNumber} validated and stock updated.` });
  } catch (err: any) {
    console.error('Validate receipt error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// OPERATIONS: DELIVERY ORDERS (OUTBOUND)
// ----------------------------------------------------------------------
apiRouter.get('/delivery-orders', requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(deliveryOrders).orderBy(desc(deliveryOrders.id));
    const whs = await db.select().from(warehouses);
    const dLines = await db
      .select({
        line: deliveryLines,
        product: products,
        location: locations,
      })
      .from(deliveryLines)
      .innerJoin(products, eq(deliveryLines.productId, products.id))
      .innerJoin(locations, eq(deliveryLines.locationId, locations.id));

    const result = list.map(d => ({
      ...d,
      warehouse: whs.find(w => w.id === d.warehouseId),
      lines: dLines.filter(l => l.line.deliveryId === d.id).map(l => ({
        ...l.line,
        product: l.product,
        location: l.location,
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/delivery-orders', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { warehouseId, customerName, shippingAddress, lines, notes } = req.body;
    const doNumber = `DO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [createdDo] = await db
      .insert(deliveryOrders)
      .values({
        doNumber,
        warehouseId: Number(warehouseId),
        customerName: customerName || 'Direct Customer',
        shippingAddress: shippingAddress || '',
        status: 'Ready',
        notes: notes || '',
      })
      .returning();

    for (const line of lines) {
      await db.insert(deliveryLines).values({
        deliveryId: createdDo.id,
        productId: Number(line.productId),
        locationId: Number(line.locationId),
        orderedQty: Number(line.orderedQty),
        pickedQty: 0,
      });
    }

    await createTargetedStaffNotification({
      title: `Picking Assignment: ${doNumber}`,
      message: `Delivery Order ${doNumber} for ${customerName || 'customer'} is ready to pick and pack.`,
      type: 'task_assigned',
      warehouseId: Number(warehouseId),
      actionUrl: '/staff/delivery-orders',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'delivery_order', doNumber, createdDo);
    res.status(201).json(createdDo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Staff pick update or flag out-of-stock
apiRouter.patch('/delivery-orders/:id/pick-line', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { lineId, pickedQty, flagOutOfStock } = req.body;
    const [line] = await db.select().from(deliveryLines).where(eq(deliveryLines.id, Number(lineId)));
    if (!line) return res.status(404).json({ error: 'Line not found' });

    await db
      .update(deliveryLines)
      .set({
        pickedQty: pickedQty !== undefined ? Number(pickedQty) : line.pickedQty,
        isOutOfStockFlagged: flagOutOfStock !== undefined ? Boolean(flagOutOfStock) : line.isOutOfStockFlagged,
      })
      .where(eq(deliveryLines.id, Number(lineId)));

    if (flagOutOfStock) {
      const [prod] = await db.select().from(products).where(eq(products.id, line.productId));
      await db.insert(notifications).values({
        title: `Out of Stock Flagged during Picking!`,
        message: `Warehouse staff encountered unavailable stock for item ${prod?.name || 'Item'} (${prod?.sku}) during order pick. Immediate reorder required.`,
        type: 'out_of_stock',
        targetRole: 'manager',
        actionUrl: `/reorder?sku=${prod?.sku}`,
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate DO -> stock -, ledger entry
apiRouter.post('/delivery-orders/:id/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const deliveryId = Number(req.params.id);
    const order = await db.query.deliveryOrders.findFirst({
      where: eq(deliveryOrders.id, deliveryId),
    });
    if (!order) return res.status(404).json({ error: 'Delivery order not found' });
    if (order.status === 'Done') return res.status(400).json({ error: 'Delivery order already completed' });

    const lines = await db.select().from(deliveryLines).where(eq(deliveryLines.deliveryId, deliveryId));

    for (const line of lines) {
      const qtyToDeduct = line.pickedQty > 0 ? line.pickedQty : line.orderedQty;

      // Find stock level
      const [stock] = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.productId, line.productId),
            eq(stockLevels.warehouseId, order.warehouseId),
            eq(stockLevels.locationId, line.locationId)
          )
        );

      const currentBalance = stock ? stock.quantity : 0;
      const newBalance = Math.max(0, currentBalance - qtyToDeduct);

      if (stock) {
        await db
          .update(stockLevels)
          .set({ quantity: newBalance, updatedAt: new Date() })
          .where(eq(stockLevels.id, stock.id));
      }

      // Ledger Entry
      await db.insert(stockLedger).values({
        productId: line.productId,
        warehouseId: order.warehouseId,
        locationId: line.locationId,
        movementType: 'DELIVERY',
        documentType: 'DO',
        documentReference: order.doNumber,
        quantityChange: -qtyToDeduct,
        newBalance,
        performedById: req.dbUser?.id,
        notes: `Shipped to ${order.customerName}`,
      });

      // Check if item reached zero or low stock -> notify manager
      const [prod] = await db.select().from(products).where(eq(products.id, line.productId));
      if (prod && newBalance <= prod.reorderThreshold) {
        await db.insert(notifications).values({
          title: newBalance === 0 ? 'Item Depleted (Out of Stock)' : 'Low Stock Warning',
          message: `${prod.name} has fallen to ${newBalance} ${prod.unitOfMeasure}. Reorder suggestion is ready.`,
          type: newBalance === 0 ? 'out_of_stock' : 'low_stock',
          targetRole: 'manager',
          actionUrl: `/reorder?sku=${prod.sku}`,
        });
      }
    }

    await db
      .update(deliveryOrders)
      .set({
        status: 'Done',
        validatedAt: new Date(),
        assignedStaffId: req.dbUser?.id,
      })
      .where(eq(deliveryOrders.id, deliveryId));

    await createAudit(req.dbUser?.id, 'VALIDATE', 'delivery_order', order.doNumber, { deliveryId });

    res.json({ success: true, message: `Delivery order ${order.doNumber} validated and dispatched.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// OPERATIONS: INTERNAL TRANSFERS
// ----------------------------------------------------------------------
apiRouter.get('/transfers', requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(internalTransfers).orderBy(desc(internalTransfers.id));
    const whs = await db.select().from(warehouses);
    const locs = await db.select().from(locations);
    const tLines = await db
      .select({
        line: transferLines,
        product: products,
      })
      .from(transferLines)
      .innerJoin(products, eq(transferLines.productId, products.id));

    const result = list.map(t => ({
      ...t,
      warehouse: whs.find(w => w.id === t.warehouseId),
      fromLocation: locs.find(l => l.id === t.fromLocationId),
      toLocation: locs.find(l => l.id === t.toLocationId),
      lines: tLines.filter(l => l.line.transferId === t.id).map(l => ({
        ...l.line,
        product: l.product,
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/transfers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { warehouseId, fromLocationId, toLocationId, productId, quantity, notes } = req.body;
    if (!warehouseId || !fromLocationId || !toLocationId || !productId || !quantity) {
      return res.status(400).json({ error: 'Warehouse, source, target location, product and quantity are required.' });
    }

    const transferNumber = `TRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [trf] = await db
      .insert(internalTransfers)
      .values({
        transferNumber,
        warehouseId: Number(warehouseId),
        fromLocationId: Number(fromLocationId),
        toLocationId: Number(toLocationId),
        status: 'Ready',
        initiatedById: req.dbUser!.id,
        notes: notes || '',
      })
      .returning();

    await db.insert(transferLines).values({
      transferId: trf.id,
      productId: Number(productId),
      quantity: Number(quantity),
    });

    await createTargetedStaffNotification({
      title: `Internal Transfer Request: ${transferNumber}`,
      message: `Transfer ${transferNumber} created. Staff requested to move stock between zones.`,
      type: 'task_assigned',
      warehouseId: Number(warehouseId),
      actionUrl: '/staff/transfers',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'internal_transfer', transferNumber, trf);
    res.status(201).json(trf);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Complete transfer
apiRouter.post('/transfers/:id/validate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const transferId = Number(req.params.id);
    const trf = await db.query.internalTransfers.findFirst({
      where: eq(internalTransfers.id, transferId),
    });
    if (!trf) return res.status(404).json({ error: 'Transfer not found' });
    if (trf.status === 'Done') return res.status(400).json({ error: 'Transfer already completed' });

    const lines = await db.select().from(transferLines).where(eq(transferLines.transferId, transferId));

    for (const line of lines) {
      // 1. Deduct from source location
      const [fromStock] = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.productId, line.productId),
            eq(stockLevels.warehouseId, trf.warehouseId),
            eq(stockLevels.locationId, trf.fromLocationId)
          )
        );

      const fromBalance = Math.max(0, (fromStock?.quantity || 0) - line.quantity);
      if (fromStock) {
        await db
          .update(stockLevels)
          .set({ quantity: fromBalance, updatedAt: new Date() })
          .where(eq(stockLevels.id, fromStock.id));
      }

      // Ledger TRANSFER_OUT
      await db.insert(stockLedger).values({
        productId: line.productId,
        warehouseId: trf.warehouseId,
        locationId: trf.fromLocationId,
        movementType: 'TRANSFER_OUT',
        documentType: 'TRANSFER',
        documentReference: trf.transferNumber,
        quantityChange: -line.quantity,
        newBalance: fromBalance,
        performedById: req.dbUser?.id,
        notes: `Transfer to Location #${trf.toLocationId}`,
      });

      // 2. Add to destination location
      const [toStock] = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.productId, line.productId),
            eq(stockLevels.warehouseId, trf.warehouseId),
            eq(stockLevels.locationId, trf.toLocationId)
          )
        );

      let toBalance = line.quantity;
      if (toStock) {
        toBalance = toStock.quantity + line.quantity;
        await db
          .update(stockLevels)
          .set({ quantity: toBalance, updatedAt: new Date() })
          .where(eq(stockLevels.id, toStock.id));
      } else {
        await db.insert(stockLevels).values({
          productId: line.productId,
          warehouseId: trf.warehouseId,
          locationId: trf.toLocationId,
          quantity: toBalance,
        });
      }

      // Ledger TRANSFER_IN
      await db.insert(stockLedger).values({
        productId: line.productId,
        warehouseId: trf.warehouseId,
        locationId: trf.toLocationId,
        movementType: 'TRANSFER_IN',
        documentType: 'TRANSFER',
        documentReference: trf.transferNumber,
        quantityChange: line.quantity,
        newBalance: toBalance,
        performedById: req.dbUser?.id,
        notes: `Transfer from Location #${trf.fromLocationId}`,
      });
    }

    await db
      .update(internalTransfers)
      .set({
        status: 'Done',
        completedById: req.dbUser?.id,
        validatedAt: new Date(),
      })
      .where(eq(internalTransfers.id, transferId));

    await createAudit(req.dbUser?.id, 'VALIDATE', 'internal_transfer', trf.transferNumber, { transferId });

    res.json({ success: true, message: `Transfer ${trf.transferNumber} completed.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// OPERATIONS: STOCK ADJUSTMENTS & PHYSICAL COUNT
// ----------------------------------------------------------------------
apiRouter.get('/adjustments', requireAuth, async (req, res) => {
  try {
    const list = await db.select().from(stockAdjustments).orderBy(desc(stockAdjustments.id));
    const whs = await db.select().from(warehouses);
    const locs = await db.select().from(locations);
    const adjLines = await db
      .select({
        line: adjustmentLines,
        product: products,
      })
      .from(adjustmentLines)
      .innerJoin(products, eq(adjustmentLines.productId, products.id));

    const result = list.map(a => ({
      ...a,
      warehouse: whs.find(w => w.id === a.warehouseId),
      location: locs.find(l => l.id === a.locationId),
      lines: adjLines.filter(l => l.line.adjustmentId === a.id).map(l => ({
        ...l.line,
        product: l.product,
      })),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/adjustments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { warehouseId, locationId, reason, staffComment, lines } = req.body;
    if (!warehouseId || !locationId || !reason || !lines || lines.length === 0) {
      return res.status(400).json({ error: 'Warehouse, location, reason, and counted lines required.' });
    }

    const adjustmentNumber = `ADJ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const [adj] = await db
      .insert(stockAdjustments)
      .values({
        adjustmentNumber,
        warehouseId: Number(warehouseId),
        locationId: Number(locationId),
        status: 'Waiting', // Requires Manager Approval
        reason,
        staffComment: staffComment || '',
        submittedById: req.dbUser!.id,
      })
      .returning();

    for (const line of lines) {
      const recorded = Number(line.recordedQty);
      const counted = Number(line.countedQty);
      const variance = counted - recorded;

      await db.insert(adjustmentLines).values({
        adjustmentId: adj.id,
        productId: Number(line.productId),
        recordedQty: recorded,
        countedQty: counted,
        varianceQty: variance,
      });

      // If counted is zero, auto-notify manager of potential out of stock
      if (counted === 0) {
        const [prod] = await db.select().from(products).where(eq(products.id, Number(line.productId)));
        await db.insert(notifications).values({
          title: `Zero Count Reported: ${prod?.name}`,
          message: `Physical stock count for ${prod?.name} (${prod?.sku}) resulted in 0 stock. Added to manager review queue.`,
          type: 'out_of_stock',
          targetRole: 'manager',
          actionUrl: `/reorder?sku=${prod?.sku}`,
        });
      }
    }

    // Notify managers
    await db.insert(notifications).values({
      title: `Stock Adjustment Pending Approval: ${adjustmentNumber}`,
      message: `Staff submitted stock count adjustment (${reason}). Variance review required.`,
      type: 'approval_pending',
      targetRole: 'manager',
      actionUrl: '/operations',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'stock_adjustment', adjustmentNumber, adj);
    res.status(201).json(adj);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manager Approve / Reject Stock Adjustment
apiRouter.post('/adjustments/:id/review', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const adjustmentId = Number(req.params.id);
    const { action, managerComment } = req.body; // action: 'APPROVE' | 'REJECT'

    const adj = await db.query.stockAdjustments.findFirst({
      where: eq(stockAdjustments.id, adjustmentId),
    });
    if (!adj) return res.status(404).json({ error: 'Adjustment not found' });
    if (adj.status !== 'Waiting') return res.status(400).json({ error: 'Adjustment is not pending review' });

    if (action === 'REJECT') {
      await db
        .update(stockAdjustments)
        .set({
          status: 'Canceled',
          managerComment: managerComment || 'Rejected by Manager',
          reviewedById: req.dbUser!.id,
          validatedAt: new Date(),
        })
        .where(eq(stockAdjustments.id, adjustmentId));

      await createAudit(req.dbUser?.id, 'REJECT', 'stock_adjustment', adj.adjustmentNumber, { managerComment });
      return res.json({ success: true, message: 'Adjustment rejected.' });
    }

    // Action === APPROVE: Apply variances to stockLevels & write to stockLedger
    const lines = await db.select().from(adjustmentLines).where(eq(adjustmentLines.adjustmentId, adjustmentId));

    for (const line of lines) {
      const [stock] = await db
        .select()
        .from(stockLevels)
        .where(
          and(
            eq(stockLevels.productId, line.productId),
            eq(stockLevels.warehouseId, adj.warehouseId),
            eq(stockLevels.locationId, adj.locationId)
          )
        );

      const newQty = line.countedQty;

      if (stock) {
        await db
          .update(stockLevels)
          .set({ quantity: newQty, updatedAt: new Date() })
          .where(eq(stockLevels.id, stock.id));
      } else {
        await db.insert(stockLevels).values({
          productId: line.productId,
          warehouseId: adj.warehouseId,
          locationId: adj.locationId,
          quantity: newQty,
        });
      }

      await db.insert(stockLedger).values({
        productId: line.productId,
        warehouseId: adj.warehouseId,
        locationId: adj.locationId,
        movementType: line.varianceQty >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
        documentType: 'ADJUSTMENT',
        documentReference: adj.adjustmentNumber,
        quantityChange: line.varianceQty,
        newBalance: newQty,
        performedById: req.dbUser?.id,
        notes: `Reason: ${adj.reason}. ${managerComment ? 'Manager note: ' + managerComment : ''}`,
      });
    }

    await db
      .update(stockAdjustments)
      .set({
        status: 'Done',
        managerComment: managerComment || 'Approved',
        reviewedById: req.dbUser!.id,
        validatedAt: new Date(),
      })
      .where(eq(stockAdjustments.id, adjustmentId));

    await createAudit(req.dbUser?.id, 'APPROVE', 'stock_adjustment', adj.adjustmentNumber, { linesCount: lines.length });

    res.json({ success: true, message: `Adjustment ${adj.adjustmentNumber} approved and applied.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// RETURNS (Customer Return & Supplier Return)
// ----------------------------------------------------------------------
apiRouter.post('/returns', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { returnType, productId, warehouseId, locationId, quantity, referenceDoc, reason } = req.body;
    // returnType: 'CUSTOMER_RETURN' (stock +) | 'SUPPLIER_RETURN' (stock -)
    const qty = Number(quantity);

    const [stock] = await db
      .select()
      .from(stockLevels)
      .where(
        and(
          eq(stockLevels.productId, Number(productId)),
          eq(stockLevels.warehouseId, Number(warehouseId)),
          eq(stockLevels.locationId, Number(locationId))
        )
      );

    const currentQty = stock ? stock.quantity : 0;
    const delta = returnType === 'CUSTOMER_RETURN' ? qty : -qty;
    const newBalance = Math.max(0, currentQty + delta);

    if (stock) {
      await db
        .update(stockLevels)
        .set({ quantity: newBalance, updatedAt: new Date() })
        .where(eq(stockLevels.id, stock.id));
    } else if (returnType === 'CUSTOMER_RETURN') {
      await db.insert(stockLevels).values({
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        locationId: Number(locationId),
        quantity: newBalance,
      });
    }

    await db.insert(stockLedger).values({
      productId: Number(productId),
      warehouseId: Number(warehouseId),
      locationId: Number(locationId),
      movementType: returnType,
      documentType: returnType === 'CUSTOMER_RETURN' ? 'DO' : 'PO',
      documentReference: referenceDoc || 'RET-' + Date.now(),
      quantityChange: delta,
      newBalance,
      performedById: req.dbUser?.id,
      notes: reason || 'Processed return',
    });

    await createAudit(req.dbUser?.id, 'CREATE', 'return', referenceDoc, { returnType, delta, newBalance });
    res.json({ success: true, newBalance });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// STOCK LEDGER & AUDIT LOGS
// ----------------------------------------------------------------------
apiRouter.get('/stock-ledger', requireAuth, async (req, res) => {
  try {
    const entries = await db
      .select({
        ledger: stockLedger,
        product: products,
        warehouse: warehouses,
        location: locations,
        user: users,
      })
      .from(stockLedger)
      .innerJoin(products, eq(stockLedger.productId, products.id))
      .innerJoin(warehouses, eq(stockLedger.warehouseId, warehouses.id))
      .innerJoin(locations, eq(stockLedger.locationId, locations.id))
      .leftJoin(users, eq(stockLedger.performedById, users.id))
      .orderBy(desc(stockLedger.createdAt))
      .limit(100);

    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/audit-logs', requireAuth, requireRole(['manager']), async (req, res) => {
  try {
    const logs = await db
      .select({
        log: auditLog,
        user: users,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(100);

    const sanitized = (logs || []).map((entry: any, index: number) => {
      const logData = entry?.log || (entry?.id || entry?.action ? entry : null);
      if (!logData) {
        return {
          log: {
            id: index + 1,
            createdAt: new Date().toISOString(),
            action: 'SYSTEM_EVENT',
            entityType: 'general',
            entityId: 'SYSTEM',
            details: '',
          },
          user: entry?.user || null,
        };
      }
      return {
        log: {
          id: logData.id || index + 1,
          createdAt: logData.createdAt ? new Date(logData.createdAt).toISOString() : new Date().toISOString(),
          action: logData.action || 'AUDIT',
          entityType: logData.entityType || 'SYSTEM',
          entityId: logData.entityId || 'N/A',
          details: typeof logData.details === 'string' ? logData.details : JSON.stringify(logData.details || {}),
        },
        user: entry?.user || null,
      };
    });

    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// WAREHOUSES & LOCATIONS
// ----------------------------------------------------------------------
apiRouter.get('/warehouses', requireAuth, async (req, res) => {
  try {
    const list = await db.query.warehouses.findMany({
      with: {
        locations: true,
      },
      orderBy: [warehouses.name],
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/warehouses', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { name, code, address, city } = req.body;
    const [inserted] = await db.insert(warehouses).values({ name, code, address, city }).returning();

    // Default primary storage and dock
    await db.insert(locations).values([
      { warehouseId: inserted.id, name: 'Receiving Dock', code: `${code}-REC`, zone: 'Dock', type: 'receiving' },
      { warehouseId: inserted.id, name: 'Main Rack A', code: `${code}-RACK-A`, zone: 'Zone A', type: 'storage' },
      { warehouseId: inserted.id, name: 'Dispatch Bay', code: `${code}-DISP`, zone: 'Dock', type: 'shipping' },
    ]);

    await createAudit(req.dbUser?.id, 'CREATE', 'warehouse', String(inserted.id), inserted);
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/locations', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const { warehouseId, name, code, zone, type } = req.body;
    const [inserted] = await db
      .insert(locations)
      .values({
        warehouseId: Number(warehouseId),
        name,
        code,
        zone: zone || 'Main',
        type: type || 'storage',
      })
      .returning();
    res.status(201).json(inserted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// STAFF & USER MANAGEMENT
// ----------------------------------------------------------------------
apiRouter.get('/staff', requireAuth, requireRole(['manager']), async (req, res) => {
  try {
    const list = await db.query.users.findMany({
      with: {
        assignedWarehouse: true,
      },
      orderBy: [users.name],
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/staff/:id', requireAuth, requireRole(['manager']), async (req: AuthRequest, res) => {
  try {
    const staffId = Number(req.params.id);
    const { role, assignedWarehouseId } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        role,
        assignedWarehouseId: assignedWarehouseId ? Number(assignedWarehouseId) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, staffId))
      .returning();

    await createAudit(req.dbUser?.id, 'UPDATE', 'user_role', String(staffId), { role, assignedWarehouseId });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// NOTIFICATIONS
// ----------------------------------------------------------------------
apiRouter.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userRole = req.dbUser?.role || 'staff';
    const userId = req.dbUser?.id;
    const userWarehouseId = req.dbUser?.assignedWarehouseId;

    const allNotifs = await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(100);

    const userList = await db.select().from(users);

    const filtered = allNotifs.filter((n: any) => {
      // Role match
      const matchesRole = !n.targetRole || n.targetRole === 'all' || n.targetRole === userRole;
      if (!matchesRole) return false;

      if (userRole === 'manager') {
        if (n.targetUserId && n.targetUserId !== userId) return false;
        return true;
      }

      // Staff role:
      // If directly addressed to this user, show it
      if (n.targetUserId) {
        return n.targetUserId === userId;
      }
      // If scoped to a specific warehouse
      if (n.targetWarehouseId) {
        return userWarehouseId ? n.targetWarehouseId === userWarehouseId : false;
      }
      // General broadcast without targetWarehouseId/targetUserId
      return true;
    });

    const populated = filtered.slice(0, 50).map((n: any) => {
      const ackUser = n.acknowledgedById ? userList.find((u) => u.id === n.acknowledgedById) : null;
      return {
        ...n,
        acknowledgedBy: ackUser ? { id: ackUser.id, name: ackUser.name, role: ackUser.role } : null,
      };
    });

    res.json(populated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Acknowledge notification (Two-way recipient status confirmation)
apiRouter.patch('/notifications/:id/acknowledge', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.dbUser?.id || null;

    await db
      .update(notifications)
      .set({
        isRead: true,
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      })
      .where(eq(notifications.id, id));

    const [updated] = await db.select().from(notifications).where(eq(notifications.id, id));
    const userList = await db.select().from(users);
    const ackUser = updated?.acknowledgedById ? userList.find((u) => u.id === updated.acknowledgedById) : null;

    res.json({
      ...updated,
      acknowledgedBy: ackUser ? { id: ackUser.id, name: ackUser.name, role: ackUser.role } : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// COMMENTS & TWO-WAY NOTES (Document-scoped collaboration)
// ----------------------------------------------------------------------
apiRouter.get('/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { documentType, documentId } = req.query;
    if (!documentType || !documentId) {
      return res.status(400).json({ error: 'documentType and documentId are required.' });
    }

    const commentList = await db
      .select()
      .from(comments)
      .where(and(eq(comments.documentType, String(documentType)), eq(comments.documentId, String(documentId))));

    const userList = await db.select().from(users);

    const populated = commentList
      .sort((a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime())
      .map((c) => {
        const author = userList.find((u) => u.id === c.authorId);
        return {
          ...c,
          author: author ? { id: author.id, name: author.name, role: author.role, email: author.email } : null,
        };
      });

    res.json(populated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/comments', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { documentType, documentId, message, warehouseId } = req.body;
    if (!documentType || !documentId || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'documentType, documentId, and message are required.' });
    }

    const currentAuthor = req.dbUser!;
    const [created] = await db
      .insert(comments)
      .values({
        documentType: String(documentType),
        documentId: String(documentId),
        authorId: currentAuthor.id,
        message: String(message).trim(),
      })
      .returning();

    // Two-way targeted notification:
    // If author is Manager -> notify assigned staff (or staff for warehouse, or staff role)
    // If author is Staff -> notify Managers
    const docUpper = String(documentType).toUpperCase();
    const snippet = message.length > 80 ? `${message.slice(0, 80)}...` : message;

    if (currentAuthor.role === 'manager') {
      await createTargetedStaffNotification({
        title: `Manager Note on ${docUpper} ${documentId}`,
        message: `${currentAuthor.name}: "${snippet}"`,
        type: 'task_assigned',
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        actionUrl: `/staff/${documentType}s`,
      });
    } else {
      await db.insert(notifications).values({
        title: `Staff Comment on ${docUpper} ${documentId}`,
        message: `${currentAuthor.name} (Floor Staff): "${snippet}"`,
        type: 'info',
        targetRole: 'manager',
        actionUrl: '/operations',
      });
    }

    res.status(201).json({
      ...created,
      author: {
        id: currentAuthor.id,
        name: currentAuthor.name,
        role: currentAuthor.role,
        email: currentAuthor.email,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// BARCODE / QR SCAN LOOKUP
// Instant resolver for physical barcodes / camera scanner
// ----------------------------------------------------------------------
apiRouter.get('/scan-lookup', requireAuth, async (req: AuthRequest, res) => {
  try {
    const code = String(req.query.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Code parameter required' });

    // Look up Product by SKU or Barcode
    const product = await db.query.products.findFirst({
      where: sql`barcode = ${code} OR sku = ${code}`,
      with: {
        stockLevels: {
          with: {
            warehouse: true,
            location: true,
          }
        },
        category: true,
      },
    });

    if (product) {
      const totalStock = product.stockLevels.reduce((a, b) => a + b.quantity, 0);
      return res.json({
        type: 'product',
        entity: {
          ...product,
          totalStock,
        },
      });
    }

    // Look up Location by Code
    const location = await db.query.locations.findFirst({
      where: eq(locations.code, code),
      with: {
        warehouse: true,
        stockLevels: {
          with: {
            product: true,
          }
        }
      }
    });

    if (location) {
      return res.json({
        type: 'location',
        entity: location,
      });
    }

    res.status(404).json({ error: 'No matching product SKU, barcode, or location code found.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// REPORTS & VALUATION
// ----------------------------------------------------------------------
apiRouter.get('/reports/valuation', requireAuth, requireRole(['manager']), async (req, res) => {
  try {
    const stockItems = await db
      .select({
        productId: stockLevels.productId,
        warehouseId: stockLevels.warehouseId,
        quantity: stockLevels.quantity,
        productName: products.name,
        sku: products.sku,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        categoryName: productCategories.name,
        warehouseName: warehouses.name,
      })
      .from(stockLevels)
      .innerJoin(products, eq(stockLevels.productId, products.id))
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .innerJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id));

    let totalValuation = 0;
    let totalPotentialRevenue = 0;

    const enriched = stockItems.map(item => {
      const cost = parseFloat(item.costPrice || '0');
      const sell = parseFloat(item.sellingPrice || '0');
      const lineCostValuation = cost * item.quantity;
      const linePotentialRevenue = sell * item.quantity;

      totalValuation += lineCostValuation;
      totalPotentialRevenue += linePotentialRevenue;

      return {
        ...item,
        lineCostValuation,
        linePotentialRevenue,
      };
    });

    res.json({
      totalValuation: parseFloat(totalValuation.toFixed(2)),
      totalPotentialRevenue: parseFloat(totalPotentialRevenue.toFixed(2)),
      projectedMargin: parseFloat((totalPotentialRevenue - totalValuation).toFixed(2)),
      breakdown: enriched,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
