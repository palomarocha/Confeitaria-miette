import { and, desc, eq, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { drizzle } from "drizzle-orm/mysql2";
import { categories, ingredients, InsertUser, orders, orderItems, payments, products, productOptions, productionTasks, recipeItems, recipes, stockMovements, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (_db) return _db;

  const databaseUrl = ENV.databaseUrl || process.env.MYSQL_URL || "";
  if (!databaseUrl) {
    console.warn("[Database] DATABASE_URL or MYSQL_URL is not configured");
    return null;
  }

  try {
    _db = drizzle(databaseUrl);
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }

  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, name: user.name, email: user.email, loginMethod: user.loginMethod, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"), lastSignedIn: new Date() };
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: { name: values.name, email: values.email, loginMethod: values.loginMethod, role: values.role, lastSignedIn: values.lastSignedIn } });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listCategories() { const db = await getDb(); return db ? db.select().from(categories).where(eq(categories.active, 1)).orderBy(categories.name) : []; }
export async function createCategory(input: { name: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const base = input.name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "categoria";
  let slug = base; let suffix = 1;
  while ((await db.select().from(categories).where(eq(categories.slug, slug)).limit(1))[0]) slug = `${base}-${++suffix}`;
  const result = await db.insert(categories).values({ name: input.name.trim(), slug });
  const row = await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1);
  return row[0];
}
export async function deleteCategory(id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(categories).set({ active: 0 }).where(eq(categories.id, id)); return { success: true } as const; }
export async function listProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ product: products, category: categories }).from(products).leftJoin(categories, eq(products.categoryId, categories.id)).where(eq(products.active, 1)).orderBy(desc(products.updatedAt));
}
export async function createProduct(input: { name: string; description: string; price: string; categoryId?: number; imageUrl?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const result = await db.insert(products).values(input); const id = Number(result[0].insertId);
  const row = await db.select().from(products).where(eq(products.id, id)).limit(1); return row[0];
}
export async function updateProduct(id: number, input: Partial<{ name: string; description: string; price: string; categoryId: number; imageUrl: string; active: number }>) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(products).set(input).where(eq(products.id, id)); const row = await db.select().from(products).where(eq(products.id, id)).limit(1); return row[0];
}
export async function deleteProduct(id: number) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(products).set({ active: 0 }).where(eq(products.id, id)); return { success: true } as const; }
export async function listProductOptions(productId: number) { const db = await getDb(); return db ? db.select().from(productOptions).where(and(eq(productOptions.productId, productId), eq(productOptions.active, 1))) : []; }

export async function createOrder(input: {
  customerName: string; customerPhone: string; customerEmail?: string; fulfillment: "pickup" | "delivery"; deliveryAddress?: string; scheduledAt: Date; paymentMethod: "pix" | "card" | "cash"; notes?: string; deliveryFee: string; items: { productId: number; productName: string; quantity: number; unitPrice: string; options?: string; notes?: string }[];
}) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const total = subtotal + Number(input.deliveryFee);
  return db.transaction(async (tx) => {
    const orderResult = await tx.insert(orders).values({ trackingCode: nanoid(10).toUpperCase(), customerName: input.customerName, customerPhone: input.customerPhone, customerEmail: input.customerEmail, fulfillment: input.fulfillment, deliveryAddress: input.deliveryAddress, scheduledAt: input.scheduledAt, paymentMethod: input.paymentMethod, subtotal: subtotal.toFixed(2), deliveryFee: input.deliveryFee, total: total.toFixed(2), notes: input.notes });
    const orderId = Number(orderResult[0].insertId);
    await tx.insert(productionTasks).values({ orderId, scheduledAt: input.scheduledAt, priority: "normal", notes: input.notes });
    if (input.items.length) await tx.insert(orderItems).values(input.items.map((item) => ({ ...item, orderId })));
    for (const item of input.items) {
      const recipeRows = await tx.select({ recipe: recipes, recipeItem: recipeItems }).from(recipes).innerJoin(recipeItems, eq(recipes.id, recipeItems.recipeId)).where(and(eq(recipes.productId, item.productId), eq(recipes.active, 1)));
      for (const row of recipeRows) {
        const consumed = Number(row.recipeItem.quantity) * item.quantity / Number(row.recipe.yieldQuantity);
        await tx.update(ingredients).set({ currentQuantity: sql`${ingredients.currentQuantity} - ${consumed}` }).where(eq(ingredients.id, row.recipeItem.ingredientId));
        await tx.insert(stockMovements).values({ ingredientId: row.recipeItem.ingredientId, type: "out", quantity: consumed.toFixed(3), reason: `Pedido #${orderId}`, orderId });
      }
    }
    await tx.insert(payments).values({ orderId, method: input.paymentMethod, amount: total.toFixed(2), status: "pending" });
    const row = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    return row[0];
  });
}
export async function listOrders() { const db = await getDb(); if (!db) return []; const rows = await db.select({ order: orders, payment: payments }).from(orders).leftJoin(payments, eq(payments.orderId, orders.id)).orderBy(desc(orders.scheduledAt)); return rows.map(({ order, payment }) => ({ ...order, payment })); }
async function getOrderById(id: number) { const db = await getDb(); if (!db) return undefined; const order = await db.select().from(orders).where(eq(orders.id, id)).limit(1); const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)); const payment = await db.select().from(payments).where(eq(payments.orderId, id)).limit(1); return order[0] ? { ...order[0], items, payment: payment[0] ?? null } : undefined; }
export async function getOrder(trackingCode: string, customerPhone: string) { const db = await getDb(); if (!db) return undefined; const order = await db.select().from(orders).where(and(eq(orders.trackingCode, trackingCode), eq(orders.customerPhone, customerPhone))).limit(1); return order[0] ? getOrderById(order[0].id) : undefined; }
export async function updateOrderStatus(id: number, status: "received" | "in_production" | "ready" | "out_for_delivery" | "delivered" | "cancelled") { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(orders).set({ status }).where(eq(orders.id, id)); return getOrderById(id); }
export async function updatePaymentStatus(orderId: number, status: "pending" | "paid" | "refunded") { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(payments).set({ status, paidAt: status === "paid" ? new Date() : null }).where(eq(payments.orderId, orderId)); return getOrderById(orderId); }
export async function getProductionAgenda() { const db = await getDb(); if (!db) return []; return db.select({ task: productionTasks, order: orders }).from(productionTasks).innerJoin(orders, eq(productionTasks.orderId, orders.id)).orderBy(productionTasks.scheduledAt); }
export async function createProductionTask(input: { orderId: number; scheduledAt: Date; priority: "normal" | "high"; notes?: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(productionTasks).values(input); const row = await db.select().from(productionTasks).where(eq(productionTasks.id, Number(result[0].insertId))).limit(1); return row[0]; }
export async function getPaymentSummary() { const db = await getDb(); if (!db) return { paid: 0, pending: 0, refunded: 0 }; const rows = await db.select({ status: payments.status, total: sql<string>`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).groupBy(payments.status); return rows.reduce((summary, row) => ({ ...summary, [row.status]: Number(row.total) }), { paid: 0, pending: 0, refunded: 0 }); }
export async function getRecipe(productId: number) { const db = await getDb(); if (!db) return undefined; const recipe = await db.select().from(recipes).where(and(eq(recipes.productId, productId), eq(recipes.active, 1))).limit(1); if (!recipe[0]) return undefined; const items = await db.select({ item: recipeItems, ingredient: ingredients }).from(recipeItems).innerJoin(ingredients, eq(recipeItems.ingredientId, ingredients.id)).where(eq(recipeItems.recipeId, recipe[0].id)); return { ...recipe[0], items }; }
export async function saveRecipe(input: { productId: number; yieldQuantity: string; items: { ingredientId: number; quantity: string }[] }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); return db.transaction(async (tx) => { await tx.update(recipes).set({ active: 0 }).where(eq(recipes.productId, input.productId)); const result = await tx.insert(recipes).values({ productId: input.productId, yieldQuantity: input.yieldQuantity, active: 1 }); const recipeId = Number(result[0].insertId); if (input.items.length) await tx.insert(recipeItems).values(input.items.map((item) => ({ recipeId, ...item }))); return getRecipe(input.productId); }); }

export async function listIngredients() { const db = await getDb(); return db ? db.select().from(ingredients).where(eq(ingredients.active, 1)).orderBy(ingredients.name) : []; }
export async function createIngredient(input: { name: string; unit: string; currentQuantity: string; minimumQuantity: string; costPerUnit: string }) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); const result = await db.insert(ingredients).values(input); const row = await db.select().from(ingredients).where(eq(ingredients.id, Number(result[0].insertId))).limit(1); return row[0]; }
export async function updateIngredient(id: number, input: Partial<{ name: string; unit: string; currentQuantity: string; minimumQuantity: string; costPerUnit: string }>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(ingredients).set(input).where(eq(ingredients.id, id)); const row = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1); return row[0]; }
export async function lowStockIngredients() { const db = await getDb(); return db ? db.select().from(ingredients).where(and(eq(ingredients.active, 1), lte(ingredients.currentQuantity, ingredients.minimumQuantity))).orderBy(ingredients.name) : []; }
export async function addStockMovement(input: { ingredientId: number; type: "in" | "out" | "adjustment"; quantity: string; reason: string; orderId?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  return db.transaction(async (tx) => { await tx.insert(stockMovements).values(input); const delta = input.type === "out" ? -Number(input.quantity) : Number(input.quantity); await tx.update(ingredients).set({ currentQuantity: sql`${ingredients.currentQuantity} + ${delta}` }).where(eq(ingredients.id, input.ingredientId)); return { success: true } as const; });
}

export async function getDashboardSummary() {
  const db = await getDb(); if (!db) return { revenue: 0, orders: 0, pending: 0, production: 0, averageTicket: 0, lowStock: 0 };
  const [revenue, count, pending, production, lowStock] = await Promise.all([
    db.select({ value: sql<string>`COALESCE(SUM(${orders.total}), 0)` }).from(orders).where(sql`${orders.status} <> 'cancelled'`),
    db.select({ value: sql<number>`COUNT(*)` }).from(orders),
    db.select({ value: sql<number>`COUNT(*)` }).from(orders).where(sql`${orders.status} = 'received'`),
    db.select({ value: sql<number>`COUNT(*)` }).from(orders).where(sql`${orders.status} = 'in_production'`),
    db.select({ value: sql<number>`COUNT(*)` }).from(ingredients).where(and(eq(ingredients.active, 1), lte(ingredients.currentQuantity, ingredients.minimumQuantity))),
  ]);
  const revenueValue = Number(revenue[0]?.value ?? 0); const orderCount = Number(count[0]?.value ?? 0);
  return { revenue: revenueValue, orders: orderCount, pending: Number(pending[0]?.value ?? 0), production: Number(production[0]?.value ?? 0), averageTicket: orderCount ? revenueValue / orderCount : 0, lowStock: Number(lowStock[0]?.value ?? 0) };
}
