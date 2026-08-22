import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";
import { addStockMovement, createCategory, createIngredient, createOrder, createProduct, createProductionTask, deleteCategory, deleteProduct, getDashboardSummary, getOrder, getPaymentSummary, getProductionAgenda, getRecipe, listCategories, listIngredients, listOrders, listProductOptions, listProducts, lowStockIngredients, saveRecipe, updateIngredient, updateOrderStatus, updatePaymentStatus, updateProduct } from "./db";

const productInput = z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().min(2), price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Preço inválido"), categoryId: z.number().int().positive().optional(), imageUrl: z.string().url().optional() });
const statusInput = z.enum(["received", "in_production", "ready", "out_for_delivery", "delivered", "cancelled"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
    profile: protectedProcedure.query(({ ctx }) => ctx.user),
  }),
  catalog: router({
    uploadImage: adminProcedure.input(z.object({ fileName: z.string().trim().min(1).max(180), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]), data: z.string().min(100).max(12000000) })).mutation(async ({ input, ctx }) => { const buffer = Buffer.from(input.data, "base64"); if (buffer.length > 8 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 8 MB."); const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-"); return storagePut(`miette/products/${ctx.user.id}/${Date.now()}-${safeName}`, buffer, input.contentType); }),
    categories: publicProcedure.query(() => listCategories()),
    createCategory: adminProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(({ input }) => createCategory(input)),
    deleteCategory: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteCategory(input.id)),
    products: publicProcedure.query(() => listProducts()),
    productOptions: publicProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => listProductOptions(input.productId)),
    createProduct: adminProcedure.input(productInput).mutation(({ input }) => createProduct(input)),
    updateProduct: adminProcedure.input(productInput.extend({ id: z.number().int().positive(), active: z.number().int().min(0).max(1).optional() })).mutation(({ input }) => { const { id, ...data } = input; return updateProduct(id, data); }),
    deleteProduct: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteProduct(input.id)),
  }),
  orders: router({
    create: publicProcedure.input(z.object({ customerName: z.string().trim().min(2), customerPhone: z.string().trim().min(8), customerEmail: z.string().email().optional(), fulfillment: z.enum(["pickup", "delivery"]), deliveryAddress: z.string().trim().optional(), scheduledAt: z.coerce.date(), paymentMethod: z.enum(["pix", "card", "cash"]), notes: z.string().optional(), deliveryFee: z.string().regex(/^\d+(\.\d{1,2})?$/).default("0"), items: z.array(z.object({ productId: z.number().int().positive(), productName: z.string(), quantity: z.number().int().positive(), unitPrice: z.string(), options: z.string().optional(), notes: z.string().optional() })).min(1) })).mutation(({ input }) => createOrder(input)),
    get: publicProcedure.input(z.object({ trackingCode: z.string().trim().min(6).max(32), customerPhone: z.string().trim().min(8) })).query(({ input }) => getOrder(input.trackingCode, input.customerPhone)),
    list: adminProcedure.query(() => listOrders()),
    updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: statusInput })).mutation(({ input }) => updateOrderStatus(input.id, input.status)),
  }),
  inventory: router({
    list: adminProcedure.query(() => listIngredients()),
    lowStock: adminProcedure.query(() => lowStockIngredients()),
    create: adminProcedure.input(z.object({ name: z.string().trim().min(2), unit: z.string().trim().min(1), currentQuantity: z.string(), minimumQuantity: z.string(), costPerUnit: z.string() })).mutation(({ input }) => createIngredient(input)),
    update: adminProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2), unit: z.string().trim().min(1), currentQuantity: z.string(), minimumQuantity: z.string(), costPerUnit: z.string() })).mutation(({ input }) => { const { id, ...data } = input; return updateIngredient(id, data); }),
    movement: adminProcedure.input(z.object({ ingredientId: z.number().int().positive(), type: z.enum(["in", "out", "adjustment"]), quantity: z.string(), reason: z.string().trim().min(2), orderId: z.number().int().positive().optional() })).mutation(({ input }) => addStockMovement(input)),
  }),
  production: router({
    agenda: adminProcedure.query(() => getProductionAgenda()),
    createTask: adminProcedure.input(z.object({ orderId: z.number().int().positive(), scheduledAt: z.coerce.date(), priority: z.enum(["normal", "high"]).default("normal"), notes: z.string().optional() })).mutation(({ input }) => createProductionTask(input)),
  }),
  payments: router({ summary: adminProcedure.query(() => getPaymentSummary()), updateStatus: adminProcedure.input(z.object({ orderId: z.number().int().positive(), status: z.enum(["pending", "paid", "refunded"]) })).mutation(({ input }) => updatePaymentStatus(input.orderId, input.status)) }),
  recipes: router({
    get: adminProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ input }) => getRecipe(input.productId)),
    save: adminProcedure.input(z.object({ productId: z.number().int().positive(), yieldQuantity: z.string(), items: z.array(z.object({ ingredientId: z.number().int().positive(), quantity: z.string() })) })).mutation(({ input }) => saveRecipe(input)),
  }),
  dashboard: router({ summary: adminProcedure.query(() => getDashboardSummary()) }),
});

export type AppRouter = typeof appRouter;
