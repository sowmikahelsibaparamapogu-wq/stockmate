import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _inMemoryDb: any | undefined;
  var _inMemoryTables: Map<string, any[]> | undefined;
  var _idCounters: Map<string, number> | undefined;
}

export const createPool = () => {
  if (!process.env.SQL_HOST) {
    return null;
  }

  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// ---------------------------------------------------------------------------
// In-Memory Database Fallback for development & instant booting in AI Studio
// ---------------------------------------------------------------------------

function getTableName(table: any): string {
  if (!table) return 'unknown';
  return (
    (table as any)?._?.name ||
    (table as any)?.[Symbol.for('drizzle:Name')] ||
    (table as any)?.[Symbol.for('drizzle:OriginalName')] ||
    (typeof table === 'string' ? table : 'unknown')
  );
}

function matchesCond(row: any, cond: any): boolean {
  if (!cond) return true;
  if (!cond.queryChunks) return true;
  const chunks = cond.queryChunks;
  let currentCol: string | undefined;
  let currentOp = '=';
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    if (c?.queryChunks) {
      if (!matchesCond(row, c)) return false;
      continue;
    }
    if (c?.name && typeof c.name === 'string') {
      currentCol = c.name;
    } else if (c?.value && Array.isArray(c.value) && c.value[0]) {
      const txt = String(c.value[0]).trim();
      if (['=', '>=', '<=', '>', '<', '!=', '<>', 'in'].includes(txt)) {
        currentOp = txt;
      }
    } else if (c?.value !== undefined && !Array.isArray(c.value)) {
      if (currentCol !== undefined) {
        const camelCol = currentCol.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
        const rowVal = row[currentCol] !== undefined ? row[currentCol] : row[camelCol];
        const paramVal = c.value;
        if (currentOp === '=' && String(rowVal) !== String(paramVal)) return false;
        if (currentOp === '!=' && String(rowVal) === String(paramVal)) return false;
        if (currentOp === '>=' && Number(rowVal) < Number(paramVal)) return false;
        if (currentOp === '<=' && Number(rowVal) > Number(paramVal)) return false;
        if (currentOp === '>' && Number(rowVal) <= Number(paramVal)) return false;
        if (currentOp === '<' && Number(rowVal) >= Number(paramVal)) return false;
        currentCol = undefined;
        currentOp = '=';
      }
    }
  }
  return true;
}

function createInMemoryDb(): any {
  if (global._inMemoryDb) return global._inMemoryDb;

  const tables = (global._inMemoryTables = global._inMemoryTables || new Map<string, any[]>());
  const idCounters = (global._idCounters = global._idCounters || new Map<string, number>());

  const getTableRows = (name: string): any[] => {
    if (!tables.has(name)) {
      tables.set(name, []);
    }
    return tables.get(name)!;
  };

  const getNextId = (name: string): number => {
    const current = idCounters.get(name) || 0;
    const next = current + 1;
    idCounters.set(name, next);
    return next;
  };

  const mockDb: any = {
    select: (fields?: any) => {
      let targetTable: any = null;
      let conditions: any[] = [];
      let groupFields: any[] = [];
      let limitCount: number | null = null;
      let offsetCount: number = 0;
      let joins: any[] = [];

      const queryBuilder: any = {
        from: (tbl: any) => {
          targetTable = tbl;
          return queryBuilder;
        },
        where: (cond: any) => {
          if (cond) conditions.push(cond);
          return queryBuilder;
        },
        groupBy: (...g: any[]) => {
          groupFields.push(...g);
          return queryBuilder;
        },
        having: () => queryBuilder,
        orderBy: () => queryBuilder,
        leftJoin: (tbl: any, on: any) => {
          joins.push({ tbl, on });
          return queryBuilder;
        },
        innerJoin: (tbl: any, on: any) => {
          joins.push({ tbl, on });
          return queryBuilder;
        },
        limit: (n: number) => {
          limitCount = n;
          return queryBuilder;
        },
        offset: (n: number) => {
          offsetCount = n;
          return queryBuilder;
        },
        then: (resolve: any, reject: any) => {
          try {
            const tblName = getTableName(targetTable);
            let rows = [...getTableRows(tblName)];
            for (const cond of conditions) {
              rows = rows.filter((r) => matchesCond(r, cond));
            }

            // Handle aggregations and entity mapping without groupBy
            if (fields && typeof fields === 'object' && groupFields.length === 0) {
              if (fields.val !== undefined || fields.count !== undefined) {
                return resolve([{ val: rows.length, count: rows.length }]);
              }
              if (fields.totalUnits !== undefined) {
                const sum = rows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0);
                return resolve([{ totalUnits: sum }]);
              }

              // Check if fields is selecting sub-table entities like { line, product, location }
              const fieldKeys = Object.keys(fields);
              const isEntityMapping = fieldKeys.some(
                (k) =>
                  k === 'line' ||
                  k === 'product' ||
                  k === 'location' ||
                  k === 'warehouse' ||
                  k === 'supplier' ||
                  (typeof fields[k] === 'object' &&
                    (fields[k]?._?.name || fields[k]?.[Symbol.for('drizzle:Name')]))
              );

              if (isEntityMapping) {
                const prods = getTableRows('products');
                const locs = getTableRows('locations');
                const whs = getTableRows('warehouses');
                const sups = getTableRows('suppliers');

                const mapped = rows.map((r) => {
                  const out: any = {};
                  for (const k of fieldKeys) {
                    if (k === 'line') {
                      out.line = r;
                    } else if (k === 'product') {
                      out.product =
                        prods.find((p) => p.id === r.productId || p.id === r.product_id) || null;
                    } else if (k === 'location') {
                      out.location =
                        locs.find((l) => l.id === r.locationId || l.id === r.location_id) || null;
                    } else if (k === 'warehouse') {
                      out.warehouse =
                        whs.find((w) => w.id === r.warehouseId || w.id === r.warehouse_id) || null;
                    } else if (k === 'supplier') {
                      out.supplier =
                        sups.find((s) => s.id === r.supplierId || s.id === r.supplier_id) || null;
                    } else {
                      out[k] = r[k];
                    }
                  }
                  return out;
                });
                return resolve(mapped);
              }
            }

            // Handle groupBy aggregations
            if (fields && typeof fields === 'object' && groupFields.length > 0) {
              const groups = new Map<string, any[]>();
              for (const r of rows) {
                const key = String(r.productId || r.product_id || r.movementType || r.date || r.id || 'default');
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(r);
              }

              const result: any[] = [];
              const posList = getTableRows('purchase_orders');

              for (const [key, groupRows] of groups.entries()) {
                const first = groupRows[0];
                const item: any = {};
                for (const fieldKey of Object.keys(fields)) {
                  if (fieldKey === 'productId') {
                    item.productId = first.productId || first.product_id || Number(key) || key;
                  } else if (fieldKey === 'totalQty') {
                    item.totalQty = groupRows.reduce(
                      (acc, r) => acc + (Number(r.quantity) || Math.abs(Number(r.quantityChange || r.quantity_change)) || 0),
                      0
                    );
                  } else if (fieldKey === 'totalMoved') {
                    item.totalMoved = groupRows.reduce(
                      (acc, r) => acc + Math.abs(Number(r.quantityChange || r.quantity_change || 0)),
                      0
                    );
                  } else if (fieldKey === 'orderedQty') {
                    item.orderedQty = groupRows.reduce(
                      (acc, r) =>
                        acc +
                        Math.max(
                          0,
                          (Number(r.quantityOrdered || r.quantity_ordered) || 0) -
                            (Number(r.quantityReceived || r.quantity_received) || 0)
                        ),
                      0
                    );
                  } else if (fieldKey === 'poNumber') {
                    const matchedPo = posList.find((p) => p.id === first.poId || p.id === first.po_id);
                    item.poNumber = matchedPo ? matchedPo.poNumber : first.poNumber || 'PO-2026-0001';
                  } else if (fieldKey === 'poStatus') {
                    const matchedPo = posList.find((p) => p.id === first.poId || p.id === first.po_id);
                    item.poStatus = matchedPo ? matchedPo.status : first.poStatus || 'Sent';
                  } else if (fieldKey === 'poId') {
                    item.poId = first.poId || first.po_id || 1;
                  } else if (fieldKey === 'date') {
                    const d = first.createdAt ? new Date(first.createdAt) : new Date();
                    item.date = d.toISOString().split('T')[0];
                  } else if (fieldKey === 'movementType') {
                    item.movementType = first.movementType || 'RECEIPT';
                  } else {
                    item[fieldKey] = first[fieldKey];
                  }
                }
                result.push(item);
              }

              if (offsetCount > 0) return resolve(result.slice(offsetCount));
              if (limitCount !== null && limitCount !== undefined) return resolve(result.slice(0, limitCount));
              return resolve(result);
            }

            if (offsetCount > 0) rows = rows.slice(offsetCount);
            if (limitCount !== null && limitCount !== undefined) rows = rows.slice(0, limitCount);

            return resolve(rows);
          } catch (e) {
            reject ? reject(e) : Promise.reject(e);
          }
        },
        catch: (reject: any) => queryBuilder.then(undefined, reject),
      };
      return queryBuilder;
    },

    insert: (tbl: any) => {
      const tblName = getTableName(tbl);
      let insertedItems: any[] = [];

      const queryBuilder: any = {
        values: (data: any) => {
          const rows = getTableRows(tblName);
          const rawItems = Array.isArray(data) ? data : [data];
          insertedItems = rawItems.map((item) => {
            const nextItem = {
              id: item.id !== undefined ? item.id : getNextId(tblName),
              createdAt: item.createdAt || new Date(),
              updatedAt: item.updatedAt || new Date(),
              ...item,
            };
            rows.push(nextItem);
            return nextItem;
          });
          return queryBuilder;
        },
        returning: () => {
          const chain: any = {
            then: (resolve: any) => resolve(insertedItems),
            catch: () => Promise.resolve(insertedItems),
          };
          return chain;
        },
        then: (resolve: any) => resolve(insertedItems),
        catch: () => Promise.resolve(insertedItems),
      };
      return queryBuilder;
    },

    update: (tbl: any) => {
      const tblName = getTableName(tbl);
      let setValues: any = {};
      let conditions: any[] = [];
      let updatedItems: any[] = [];

      const queryBuilder: any = {
        set: (vals: any) => {
          setValues = vals;
          return queryBuilder;
        },
        where: (cond: any) => {
          if (cond) conditions.push(cond);
          return queryBuilder;
        },
        returning: () => {
          const chain: any = {
            then: (resolve: any) => {
              applyUpdate();
              return resolve(updatedItems);
            },
            catch: () => Promise.resolve(updatedItems),
          };
          return chain;
        },
        then: (resolve: any) => {
          applyUpdate();
          return resolve(updatedItems);
        },
        catch: () => Promise.resolve(updatedItems),
      };

      const applyUpdate = () => {
        const rows = getTableRows(tblName);
        updatedItems = [];
        for (let i = 0; i < rows.length; i++) {
          let matches = true;
          for (const cond of conditions) {
            if (!matchesCond(rows[i], cond)) {
              matches = false;
              break;
            }
          }
          if (matches) {
            rows[i] = {
              ...rows[i],
              ...setValues,
              updatedAt: new Date(),
            };
            updatedItems.push(rows[i]);
          }
        }
      };

      return queryBuilder;
    },

    delete: (tbl: any) => {
      const tblName = getTableName(tbl);
      let conditions: any[] = [];

      const queryBuilder: any = {
        where: (cond: any) => {
          if (cond) conditions.push(cond);
          return queryBuilder;
        },
        then: (resolve: any) => {
          const rows = getTableRows(tblName);
          if (conditions.length === 0) {
            tables.set(tblName, []);
            return resolve([]);
          }
          const remaining = rows.filter((r) => !conditions.every((c) => matchesCond(r, c)));
          tables.set(tblName, remaining);
          return resolve([]);
        },
        catch: () => Promise.resolve([]),
      };
      return queryBuilder;
    },

    transaction: async (cb: any) => {
      return await cb(mockDb);
    },

    query: new Proxy(
      {},
      {
        get: (_, tableName: string) => {
          const populateWith = (row: any, withConfig: any) => {
            if (!row || !withConfig) return row;
            const res = { ...row };
            if (withConfig.category) {
              res.category =
                getTableRows('product_categories').find((c) => c.id === row.categoryId) || null;
            }
            if (withConfig.stockLevels) {
              res.stockLevels = getTableRows('stock_levels').filter((s) => s.productId === row.id);
            }
            if (withConfig.batches) {
              res.batches = getTableRows('batches').filter((b) => b.productId === row.id);
            }
            if (withConfig.locations) {
              res.locations = getTableRows('locations').filter((l) => l.warehouseId === row.id);
            }
            if (withConfig.warehouse) {
              res.warehouse =
                getTableRows('warehouses').find((w) => w.id === row.warehouseId) || null;
            }
            if (withConfig.supplier) {
              res.supplier =
                getTableRows('suppliers').find((s) => s.id === row.supplierId) || null;
            }
            if (withConfig.assignedWarehouse) {
              res.assignedWarehouse =
                getTableRows('warehouses').find((w) => w.id === row.assignedWarehouseId) || null;
            }
            return res;
          };

          return {
            findFirst: async ({ where, with: withConfig }: any = {}) => {
              const rows = getTableRows(tableName);
              let found = rows;
              if (where) found = rows.filter((r) => matchesCond(r, where));
              return found[0] ? populateWith(found[0], withConfig) : null;
            },
            findMany: async ({ where, with: withConfig, limit }: any = {}) => {
              let rows = getTableRows(tableName);
              if (where) rows = rows.filter((r) => matchesCond(r, where));
              if (limit) rows = rows.slice(0, limit);
              return rows.map((r) => populateWith(r, withConfig));
            },
          };
        },
      }
    ),
  };

  global._inMemoryDb = mockDb;
  return mockDb;
}

const pool = createPool();
export const db = (pool
  ? drizzle(pool, { schema })
  : createInMemoryDb()) as unknown as NodePgDatabase<typeof schema>;
