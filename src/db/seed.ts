import { db } from './index.ts';
import {
  warehouses,
  locations,
  productCategories,
  products,
  suppliers,
  stockLevels,
  batches,
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
  notifications,
  auditLog,
  users,
} from './schema.ts';
import { count, eq } from 'drizzle-orm';

/**
 * Resets and populates the database with comprehensive demo data
 * covering ALL operational workflows:
 * 1. Inbound Receiving (Receipts ready to validate)
 * 2. Outbound Delivery Orders (Ready to pick & dispatch)
 * 3. Internal Transfers (Ready to execute)
 * 4. Cycle Count Discrepancies (Stock adjustments waiting for manager review)
 * 5. Low & Out-of-Stock items (Ready to test 1-Click Instant Auto-Reorder)
 * 6. Batch & Expiry tracking (Cold chain items)
 * 7. Unified Stock Movement Ledger & Audit Logs
 */
export async function resetAndSeedDemoDatabase() {
  console.log('Resetting and seeding rich demo dataset into PostgreSQL...');

  // 1. Clean existing transactional & inventory data in foreign-key safe order
  await db.delete(adjustmentLines);
  await db.delete(stockAdjustments);
  await db.delete(transferLines);
  await db.delete(internalTransfers);
  await db.delete(deliveryLines);
  await db.delete(deliveryOrders);
  await db.delete(receiptLines);
  await db.delete(receipts);
  await db.delete(poLines);
  await db.delete(purchaseOrders);
  await db.delete(stockLedger);
  await db.delete(stockLevels);
  await db.delete(batches);
  await db.delete(notifications);
  await db.delete(auditLog);
  await db.delete(products);
  await db.delete(productCategories);
  await db.delete(suppliers);
  await db.delete(locations);
  await db.delete(warehouses);

  // 2. Ensure system users exist (preserve existing logged-in users)
  let [managerUser] = await db.select().from(users).where(eq(users.role, 'manager')).limit(1);
  if (!managerUser) {
    [managerUser] = await db
      .insert(users)
      .values({
        uid: 'stocksense-system-admin',
        email: 'manager@stocksense.corp',
        name: 'Chief Inventory Manager',
        role: 'manager',
      })
      .returning();
  }

  let [staffUser] = await db.select().from(users).where(eq(users.role, 'staff')).limit(1);
  if (!staffUser) {
    [staffUser] = await db
      .insert(users)
      .values({
        uid: 'stocksense-staff-demo',
        email: 'staff@stocksense.corp',
        name: 'Warehouse Operations Staff',
        role: 'staff',
      })
      .returning();
  }

  // 3. Seed Warehouses
  const [whCentral, whWestside, whNorth] = await db
    .insert(warehouses)
    .values([
      {
        name: 'Central Distribution Center',
        code: 'CDC-01',
        address: '100 Logistics Way, Bay 4',
        city: 'Singapore',
        isActive: true,
      },
      {
        name: 'Westside Bulk Hub',
        code: 'WBH-02',
        address: '42 Jurong Industrial Ave',
        city: 'Singapore',
        isActive: true,
      },
      {
        name: 'North Cold-Chain Facility',
        code: 'NCC-03',
        address: '8 Biotech Park Link',
        city: 'Singapore',
        isActive: true,
      },
    ])
    .returning();

  // Assign warehouses to staff & manager
  await db.update(users).set({ assignedWarehouseId: whCentral.id }).where(eq(users.id, managerUser.id));
  await db.update(users).set({ assignedWarehouseId: whCentral.id }).where(eq(users.id, staffUser.id));

  // 4. Seed Locations
  const [
    locCdcRec,
    locCdcRackA1,
    locCdcRackA2,
    locCdcDisp,
    locWbhBulk,
    locWbhDisp,
    locNccCold,
  ] = await db
    .insert(locations)
    .values([
      { warehouseId: whCentral.id, name: 'Receiving Dock 1', code: 'CDC-REC-01', zone: 'Dock', type: 'receiving' },
      { warehouseId: whCentral.id, name: 'Rack A-01-A (Dry Storage)', code: 'CDC-R-A1A', zone: 'Zone A', type: 'storage' },
      { warehouseId: whCentral.id, name: 'Rack A-02-B (Perishable)', code: 'CDC-R-A2B', zone: 'Zone A', type: 'storage' },
      { warehouseId: whCentral.id, name: 'Dispatch Bay 1', code: 'CDC-DISP-01', zone: 'Dock', type: 'shipping' },
      { warehouseId: whWestside.id, name: 'Bulk Pallet Row 1', code: 'WBH-BLK-01', zone: 'Zone B', type: 'storage' },
      { warehouseId: whWestside.id, name: 'Westside Outbound Bay', code: 'WBH-DISP-01', zone: 'Dock', type: 'shipping' },
      { warehouseId: whNorth.id, name: 'Ultra-Cold Chamber -20C', code: 'NCC-COLD-01', zone: 'Cold Zone', type: 'storage' },
    ])
    .returning();

  // 5. Seed Product Categories
  const [catElectronics, catPerishables, catPackaging, catRaw, catRobotics] = await db
    .insert(productCategories)
    .values([
      { name: 'Industrial Electronics', description: 'Sensors, microcontrollers, and relay modules' },
      { name: 'Perishables & Biotech', description: 'Temperature controlled reagents and consumables' },
      { name: 'Packaging & Logistics', description: 'Heavy duty boxes, protective bubble mailers, and pallet wrap' },
      { name: 'Raw Materials & Hardware', description: 'Machine fasteners, structural brackets, and fixtures' },
      { name: 'Robotics & Edge IoT', description: 'Industrial automation gateways and lithium power cells' },
    ])
    .returning();

  // 6. Seed Suppliers
  const [supApex, supNova, supGlobal, supVanguard] = await db
    .insert(suppliers)
    .values([
      {
        name: 'Apex Precision Logistics & Tech',
        code: 'SUP-APEX',
        contactName: 'David Lee',
        email: 'sales@apextech.corp',
        phone: '+65 6789 0123',
        leadTimeDays: 4,
        address: '88 Tech Park Crescent, Singapore',
      },
      {
        name: 'Nova Bio Supplies Pte Ltd',
        code: 'SUP-NOVA',
        contactName: 'Elena Rostova',
        email: 'orders@novabio.com',
        phone: '+65 6234 5678',
        leadTimeDays: 2,
        address: '15 Science Park Drive, Singapore',
      },
      {
        name: 'Global Packaging Solutions',
        code: 'SUP-GLOBAL',
        contactName: 'Marcus Wong',
        email: 'marcus@globalpack.sg',
        phone: '+65 6555 8899',
        leadTimeDays: 5,
        address: '22 Tuas Loop, Singapore',
      },
      {
        name: 'Vanguard Microelectronics Corp',
        code: 'SUP-VANGUARD',
        contactName: 'Sarah Jenkins',
        email: 'supply@vanguardmicro.com',
        phone: '+65 6111 2233',
        leadTimeDays: 3,
        address: '50 Changi Business Park, Singapore',
      },
    ])
    .returning();

  // 7. Seed Products with distinct operational states
  const [pSensor, pBioReagent, pShipBox, pFasteners, pIotGateway, pLithiumCell] = await db
    .insert(products)
    .values([
      {
        name: 'Optical Proximity Sensor IR-400',
        sku: 'SKU-IND-4001',
        barcode: '890123450001',
        categoryId: catElectronics.id,
        unitOfMeasure: 'units',
        unitsPerBox: 10,
        costPrice: '45.00',
        sellingPrice: '78.50',
        reorderThreshold: 25,
        trackBatchExpiry: false,
        description: 'High-precision photoelectric proximity switch with digital I/O for robotic assembly lines',
      },
      {
        name: 'Enzyme Stabilizer Buffer 500ml',
        sku: 'SKU-BIO-0500',
        barcode: '890123450002',
        categoryId: catPerishables.id,
        unitOfMeasure: 'bottles',
        unitsPerBox: 6,
        costPrice: '120.00',
        sellingPrice: '195.00',
        reorderThreshold: 15,
        trackBatchExpiry: true,
        description: 'Cold-chain storage laboratory grade stabilization reagent (-20°C to 4°C)',
      },
      {
        name: 'Reinforced Corrugated Box 350x250x200mm',
        sku: 'SKU-PKG-3520',
        barcode: '890123450003',
        categoryId: catPackaging.id,
        unitOfMeasure: 'boxes',
        unitsPerBox: 50,
        costPrice: '1.20',
        sellingPrice: '2.80',
        reorderThreshold: 100,
        trackBatchExpiry: false,
        description: 'Double-walled heavy duty carton shipping boxes for industrial freight',
      },
      {
        name: 'M4 Stainless Hex Screws (Pack 500)',
        sku: 'SKU-RAW-0044',
        barcode: '890123450004',
        categoryId: catRaw.id,
        unitOfMeasure: 'packs',
        unitsPerBox: 1,
        costPrice: '18.50',
        sellingPrice: '32.00',
        reorderThreshold: 40,
        trackBatchExpiry: false,
        description: 'Grade 316 marine-grade stainless machine screws with hex drive',
      },
      {
        name: 'IoT Edge Gateway Controller Pro',
        sku: 'SKU-IOT-8800',
        barcode: '890123450005',
        categoryId: catRobotics.id,
        unitOfMeasure: 'units',
        unitsPerBox: 5,
        costPrice: '210.00',
        sellingPrice: '345.00',
        reorderThreshold: 20,
        trackBatchExpiry: false,
        description: 'Quad-core DIN-rail edge computing unit with dual Gigabit Ethernet and CAN bus',
      },
      {
        name: 'High-Capacity LiFePO4 Cell 3.2V 100Ah',
        sku: 'SKU-BAT-3200',
        barcode: '890123450006',
        categoryId: catRobotics.id,
        unitOfMeasure: 'units',
        unitsPerBox: 4,
        costPrice: '85.00',
        sellingPrice: '142.00',
        reorderThreshold: 30,
        trackBatchExpiry: true,
        description: 'Prismatic deep-cycle lithium iron phosphate battery cell with batch warranty tracking',
      },
    ])
    .returning();

  // 8. Seed Batches for perishable & battery items
  const now = new Date();
  const sixMonthsFromNow = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const [batchBio, batchBattery] = await db
    .insert(batches)
    .values([
      {
        productId: pBioReagent.id,
        batchNo: 'BATCH-2026-X8',
        manufacturingDate: new Date('2026-06-01T00:00:00Z'),
        expiryDate: sixMonthsFromNow,
      },
      {
        productId: pLithiumCell.id,
        batchNo: 'LOT-BAT-2026-Q2',
        manufacturingDate: new Date('2026-05-15T00:00:00Z'),
        expiryDate: oneYearFromNow,
      },
    ])
    .returning();

  // 9. Initial Stock Levels
  await db.insert(stockLevels).values([
    // Sensor: total 18 (below reorder threshold 25 -> Low Stock!)
    { productId: pSensor.id, warehouseId: whCentral.id, locationId: locCdcRackA1.id, quantity: 18 },
    // Bio Reagent: total 6 (below reorder threshold 15 -> Low Stock + Batch Expiry!)
    { productId: pBioReagent.id, warehouseId: whCentral.id, locationId: locCdcRackA2.id, batchId: batchBio.id, quantity: 6 },
    // Boxes: 220 at Central, 100 at Westside
    { productId: pShipBox.id, warehouseId: whCentral.id, locationId: locCdcRackA1.id, quantity: 220 },
    { productId: pShipBox.id, warehouseId: whWestside.id, locationId: locWbhBulk.id, quantity: 100 },
    // Fasteners: 0 units -> OUT OF STOCK!
    { productId: pFasteners.id, warehouseId: whCentral.id, locationId: locCdcRackA1.id, quantity: 0 },
    // IoT Gateway: 45 units (Healthy stock)
    { productId: pIotGateway.id, warehouseId: whCentral.id, locationId: locCdcRackA1.id, quantity: 45 },
    // Lithium Cell: 8 units at Westside Bulk (below threshold 30)
    { productId: pLithiumCell.id, warehouseId: whWestside.id, locationId: locWbhBulk.id, batchId: batchBattery.id, quantity: 8 },
  ]);

  // 10. Initial Stock Ledger Entries for history, valuation, and margin calculations
  await db.insert(stockLedger).values([
    {
      productId: pSensor.id,
      warehouseId: whCentral.id,
      locationId: locCdcRackA1.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT01',
      quantityChange: 18,
      newBalance: 18,
      unitCost: '45.00',
      performedById: managerUser.id,
      notes: 'Initial inventory load for production',
    },
    {
      productId: pBioReagent.id,
      warehouseId: whCentral.id,
      locationId: locCdcRackA2.id,
      batchId: batchBio.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT02',
      quantityChange: 6,
      newBalance: 6,
      unitCost: '120.00',
      performedById: managerUser.id,
      notes: 'Initial cold chain inventory load (Batch: BATCH-2026-X8)',
    },
    {
      productId: pShipBox.id,
      warehouseId: whCentral.id,
      locationId: locCdcRackA1.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT03',
      quantityChange: 220,
      newBalance: 220,
      unitCost: '1.20',
      performedById: managerUser.id,
      notes: 'Initial packaging stock load',
    },
    {
      productId: pShipBox.id,
      warehouseId: whWestside.id,
      locationId: locWbhBulk.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT04',
      quantityChange: 100,
      newBalance: 100,
      unitCost: '1.20',
      performedById: managerUser.id,
      notes: 'Westside Bulk Hub initial load',
    },
    {
      productId: pIotGateway.id,
      warehouseId: whCentral.id,
      locationId: locCdcRackA1.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT05',
      quantityChange: 45,
      newBalance: 45,
      unitCost: '210.00',
      performedById: managerUser.id,
      notes: 'IoT Gateway initial delivery load',
    },
    {
      productId: pLithiumCell.id,
      warehouseId: whWestside.id,
      locationId: locWbhBulk.id,
      batchId: batchBattery.id,
      movementType: 'RECEIPT',
      documentType: 'RECEIPT',
      documentReference: 'REC-2026-INIT06',
      quantityChange: 8,
      newBalance: 8,
      unitCost: '85.00',
      performedById: managerUser.id,
      notes: 'Battery cell pack initial load (LOT-BAT-2026-Q2)',
    },
  ]);

  // 11. Purchase Orders & Inbound Receipts (Ready for Inbound Receiving Operations!)
  const [po1, po2, poHist] = await db
    .insert(purchaseOrders)
    .values([
      {
        poNumber: 'PO-2026-0001',
        supplierId: supApex.id,
        warehouseId: whCentral.id,
        status: 'Sent',
        notes: 'Inbound shipment from Apex Tech - Optical Sensors & Hex Screws',
        createdById: managerUser.id,
      },
      {
        poNumber: 'PO-2026-0002',
        supplierId: supNova.id,
        warehouseId: whCentral.id,
        status: 'Sent',
        notes: 'Cold chain expedited restock for laboratory buffer reagents',
        createdById: managerUser.id,
      },
      {
        poNumber: 'PO-2026-HIST01',
        supplierId: supGlobal.id,
        warehouseId: whCentral.id,
        status: 'Received',
        notes: 'Quarterly bulk packaging replenishment (Fully received)',
        createdById: managerUser.id,
      },
    ])
    .returning();

  // PO Lines
  await db.insert(poLines).values([
    {
      poId: po1.id,
      productId: pSensor.id,
      quantityOrdered: 30,
      quantityReceived: 0,
      unitPrice: '45.00',
      autoSuggested: true,
      suggestedQty: 30,
    },
    {
      poId: po1.id,
      productId: pFasteners.id,
      quantityOrdered: 50,
      quantityReceived: 0,
      unitPrice: '18.50',
      autoSuggested: true,
      suggestedQty: 50,
    },
    {
      poId: po2.id,
      productId: pBioReagent.id,
      quantityOrdered: 20,
      quantityReceived: 0,
      unitPrice: '120.00',
      autoSuggested: true,
      suggestedQty: 20,
    },
    {
      poId: poHist.id,
      productId: pShipBox.id,
      quantityOrdered: 500,
      quantityReceived: 500,
      unitPrice: '1.20',
      autoSuggested: false,
    },
  ]);

  // Inbound Receipts ready for staff or manager to test the RECEIVING & VALIDATION operation!
  const [rec1, rec2] = await db
    .insert(receipts)
    .values([
      {
        receiptNumber: 'REC-2026-0001',
        poId: po1.id,
        warehouseId: whCentral.id,
        status: 'Ready',
        sourceDocument: po1.poNumber,
        notes: 'Arrived at Central Receiving Dock 1. Ready for inspection and putaway.',
      },
      {
        receiptNumber: 'REC-2026-0002',
        poId: po2.id,
        warehouseId: whCentral.id,
        status: 'Ready',
        sourceDocument: po2.poNumber,
        notes: 'Cold chain insulated package arrived. Check temperature monitor.',
      },
    ])
    .returning();

  // Receipt Lines
  await db.insert(receiptLines).values([
    {
      receiptId: rec1.id,
      productId: pSensor.id,
      locationId: locCdcRec.id,
      expectedQty: 30,
      receivedQty: 0,
    },
    {
      receiptId: rec1.id,
      productId: pFasteners.id,
      locationId: locCdcRec.id,
      expectedQty: 50,
      receivedQty: 0,
    },
    {
      receiptId: rec2.id,
      productId: pBioReagent.id,
      locationId: locCdcRec.id,
      batchNo: 'BATCH-2026-NOV2',
      expiryDate: sixMonthsFromNow,
      expectedQty: 20,
      receivedQty: 0,
    },
  ]);

  // 12. Delivery Orders (Outbound Operations: Ready for Pick & Pack & Dispatch!)
  const [do1, do2] = await db
    .insert(deliveryOrders)
    .values([
      {
        doNumber: 'DO-2026-0001',
        warehouseId: whCentral.id,
        customerName: 'AeroDynamics Engineering SG',
        shippingAddress: '12 Aerospace Park Way, #03-01, Singapore',
        status: 'Ready',
        notes: 'Priority dispatch for maintenance overhaul line.',
      },
      {
        doNumber: 'DO-2026-0002',
        warehouseId: whCentral.id,
        customerName: 'Quantum Robotics Lab Pte Ltd',
        shippingAddress: '88 Innovation Boulevard, Tech Wing B, Singapore',
        status: 'Ready',
        notes: 'Standard dispatch for prototype build sprint.',
      },
    ])
    .returning();

  // Delivery Lines ready for picking
  await db.insert(deliveryLines).values([
    {
      deliveryId: do1.id,
      productId: pShipBox.id,
      locationId: locCdcRackA1.id,
      orderedQty: 20,
      pickedQty: 0,
      isOutOfStockFlagged: false,
    },
    {
      deliveryId: do1.id,
      productId: pSensor.id,
      locationId: locCdcRackA1.id,
      orderedQty: 2,
      pickedQty: 0,
      isOutOfStockFlagged: false,
    },
    {
      deliveryId: do2.id,
      productId: pIotGateway.id,
      locationId: locCdcRackA1.id,
      orderedQty: 5,
      pickedQty: 0,
      isOutOfStockFlagged: false,
    },
  ]);

  // 13. Internal Transfers (Ready to Execute & Validate!)
  const [trf1, trf2] = await db
    .insert(internalTransfers)
    .values([
      {
        transferNumber: 'TRF-2026-0001',
        warehouseId: whCentral.id,
        fromLocationId: locCdcRackA1.id,
        toLocationId: locCdcDisp.id,
        status: 'Ready',
        initiatedById: managerUser.id,
        notes: 'Pre-staging heavy shipping cartons to Dispatch Bay 1 for tomorrow morning truck.',
      },
      {
        transferNumber: 'TRF-2026-0002',
        warehouseId: whCentral.id,
        fromLocationId: locCdcRec.id,
        toLocationId: locCdcRackA1.id,
        status: 'Ready',
        initiatedById: managerUser.id,
        notes: 'Putaway transfer of incoming sensors to main dry storage rack.',
      },
    ])
    .returning();

  await db.insert(transferLines).values([
    {
      transferId: trf1.id,
      productId: pShipBox.id,
      quantity: 15,
    },
    {
      transferId: trf2.id,
      productId: pSensor.id,
      quantity: 5,
    },
  ]);

  // 14. Stock Adjustments (Physical Count Discrepancies Waiting for Manager Review!)
  // This allows managers to test the Review & Approval / Rejection workflow!
  const [adj1, adj2] = await db
    .insert(stockAdjustments)
    .values([
      {
        adjustmentNumber: 'ADJ-2026-0001',
        warehouseId: whCentral.id,
        locationId: locCdcRackA1.id,
        status: 'Waiting', // Requires Manager Approval!
        reason: 'Cycle Count Discrepancy',
        staffComment: 'Physical count found 13 units on shelf instead of 18 recorded. 5 units damaged or mislocated.',
        submittedById: staffUser.id,
      },
      {
        adjustmentNumber: 'ADJ-2026-0002',
        warehouseId: whWestside.id,
        locationId: locWbhBulk.id,
        status: 'Waiting', // Requires Manager Approval!
        reason: 'Annual Audit',
        staffComment: 'Found +10 extra reinforced cartons bundled on top pallet tier during shift audit.',
        submittedById: staffUser.id,
      },
    ])
    .returning();

  await db.insert(adjustmentLines).values([
    {
      adjustmentId: adj1.id,
      productId: pSensor.id,
      recordedQty: 18,
      countedQty: 13,
      varianceQty: -5,
    },
    {
      adjustmentId: adj2.id,
      productId: pShipBox.id,
      recordedQty: 100,
      countedQty: 110,
      varianceQty: 10,
    },
  ]);

  // 15. System Notifications for real-time monitoring
  await db.insert(notifications).values([
    {
      title: 'Critical Out-of-Stock Alert',
      message: 'M4 Stainless Hex Screws (SKU-RAW-0044) is completely out of stock (0 packs). Use 1-Click Auto-Order to replenish.',
      type: 'out_of_stock',
      targetRole: 'manager',
      actionUrl: `/reorder?sku=SKU-RAW-0044`,
      isRead: false,
    },
    {
      title: 'Low Stock Threshold Warning',
      message: 'Optical Proximity Sensor IR-400 (SKU-IND-4001) has only 18 units left (threshold: 25).',
      type: 'low_stock',
      targetRole: 'manager',
      actionUrl: `/reorder?sku=SKU-IND-4001`,
      isRead: false,
    },
    {
      title: 'Stock Adjustment Pending Approval: ADJ-2026-0001',
      message: 'Warehouse staff submitted a cycle count variance (-5 units for Optical Sensors). Manager review required.',
      type: 'approval_pending',
      targetRole: 'manager',
      actionUrl: '/operations',
      isRead: false,
    },
    {
      title: 'Inbound Shipment Ready: REC-2026-0001',
      message: 'PO-2026-0001 delivery has arrived at Receiving Dock 1. Ready for inspection and putaway.',
      type: 'task_assigned',
      targetRole: 'staff',
      actionUrl: '/staff/receipts',
      isRead: false,
    },
    {
      title: 'Outbound Picking Task: DO-2026-0001',
      message: 'Delivery order DO-2026-0001 for AeroDynamics Engineering SG is ready for pick & pack.',
      type: 'task_assigned',
      targetRole: 'staff',
      actionUrl: '/staff/delivery-orders',
      isRead: false,
    },
  ]);

  // 16. Audit Log
  await db.insert(auditLog).values([
    {
      userId: managerUser.id,
      action: 'SYSTEM_SEED',
      entityType: 'database',
      entityId: 'DEMO_DATASET',
      details: JSON.stringify({
        warehouses: 3,
        products: 6,
        suppliers: 4,
        operations: ['receipts', 'delivery_orders', 'transfers', 'adjustments', 'auto_reorder'],
      }),
    },
    {
      userId: managerUser.id,
      action: 'CREATE',
      entityType: 'purchase_order',
      entityId: po1.poNumber,
      details: JSON.stringify({ poNumber: po1.poNumber, status: 'Sent' }),
    },
    {
      userId: staffUser.id,
      action: 'SUBMIT_COUNT',
      entityType: 'stock_adjustment',
      entityId: adj1.adjustmentNumber,
      details: JSON.stringify({ adjustmentNumber: adj1.adjustmentNumber, variance: -5 }),
    },
  ]);

  console.log('StockSense demo dataset successfully populated with all operational workflows.');
}

/**
 * Initializes the database if empty
 */
export async function seedInitialDatabase() {
  try {
    const [warehouseCount] = await db.select({ val: count() }).from(warehouses);
    if (warehouseCount.val > 0) {
      console.log('Database already initialized with seed data.');
      return;
    }

    await resetAndSeedDemoDatabase();
  } catch (err) {
    console.error('Error in seedInitialDatabase:', err);
  }
}
