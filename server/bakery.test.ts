import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({ storagePut: vi.fn() }));
vi.mock("./storage", () => storageMocks);

const dbMocks = vi.hoisted(() => ({
  listCategories: vi.fn(), listProducts: vi.fn(), listProductOptions: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn(), createOrder: vi.fn(), getOrder: vi.fn(), listOrders: vi.fn(), updateOrderStatus: vi.fn(), listIngredients: vi.fn(), lowStockIngredients: vi.fn(), createIngredient: vi.fn(), updateIngredient: vi.fn(), addStockMovement: vi.fn(), getDashboardSummary: vi.fn(), getPaymentSummary: vi.fn(), updatePaymentStatus: vi.fn(),
}));
vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "admin" = "user"): TrpcContext {
  return { user: { id: 1, openId: "tester", name: "Teste", email: "teste@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

const product = { id: 1, categoryId: null, name: "Bolo de chocolate", description: "Massa intensa", imageUrl: null, price: "89.90", active: 1, createdAt: new Date(), updatedAt: new Date() };

describe("bakery routers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permite administrador enviar uma foto de produto", async () => {
    storageMocks.storagePut.mockResolvedValue({ key: "miette/products/photo.png", url: "/manus-storage/miette/products/photo.png" });
    const result = await appRouter.createCaller(context("admin")).catalog.uploadImage({ fileName: "bolo.png", contentType: "image/png", data: "a".repeat(120) });
    expect(result.url).toContain("/manus-storage/");
    expect(storageMocks.storagePut).toHaveBeenCalled();
  });

  it("lista produtos publicamente", async () => {
    dbMocks.listProducts.mockResolvedValue([{ product, category: null }]);
    const result = await appRouter.createCaller(context()).catalog.products();
    expect(result[0]?.product.name).toBe("Bolo de chocolate");
  });

  it("cria pedido público com itens válidos", async () => {
    dbMocks.createOrder.mockResolvedValue({ id: 10, status: "received", total: "89.90" });
    const input = { customerName: "Ana Silva", customerPhone: "11999999999", fulfillment: "pickup" as const, scheduledAt: new Date("2026-09-01T14:00:00Z"), paymentMethod: "pix" as const, deliveryFee: "0", items: [{ productId: 1, productName: "Bolo de chocolate", quantity: 1, unitPrice: "89.90" }] };
    const result = await appRouter.createCaller(context()).orders.create(input);
    expect(result?.status).toBe("received");
    expect(dbMocks.createOrder).toHaveBeenCalledWith(input);
  });

  it("permite administrador avançar o status do pedido", async () => {
    dbMocks.updateOrderStatus.mockResolvedValue({ id: 10, status: "in_production" });
    const result = await appRouter.createCaller(context("admin")).orders.updateStatus({ id: 10, status: "in_production" });
    expect(result?.status).toBe("in_production");
  });

  it("bloqueia dashboard para usuário comum", async () => {
    await expect(appRouter.createCaller(context("user")).dashboard.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("retorna resumo do dashboard para administrador", async () => {
    dbMocks.getDashboardSummary.mockResolvedValue({ revenue: 1200, orders: 12, pending: 2, production: 3, averageTicket: 100, lowStock: 1 });
    const result = await appRouter.createCaller(context("admin")).dashboard.summary();
    expect(result.orders).toBe(12);
    expect(result.lowStock).toBe(1);
  });

  it("permite consultar o pedido por código sem login", async () => {
    dbMocks.getOrder.mockResolvedValue({ trackingCode: "AB12CD34", id: 10, status: "received", payment: { status: "pending" } });
    const result = await appRouter.createCaller(context()).orders.get({ trackingCode: "AB12CD34", customerPhone: "11999999999" });
    expect(result?.id).toBe(10);
    expect(result?.payment?.status).toBe("pending");
  });

  it("permite ao administrador marcar pagamento como pago ou estornado", async () => {
    dbMocks.updatePaymentStatus.mockResolvedValue({ id: 10, payment: { status: "paid" } });
    const caller = appRouter.createCaller(context("admin"));
    const paid = await caller.payments.updateStatus({ orderId: 10, status: "paid" });
    expect(paid?.payment?.status).toBe("paid");
    expect(dbMocks.updatePaymentStatus).toHaveBeenCalledWith(10, "paid");
    dbMocks.updatePaymentStatus.mockResolvedValue({ id: 10, payment: { status: "refunded" } });
    const refunded = await caller.payments.updateStatus({ orderId: 10, status: "refunded" });
    expect(refunded?.payment?.status).toBe("refunded");
  });

  it("bloqueia atualização de pagamento para usuário comum", async () => {
    await expect(appRouter.createCaller(context()).payments.updateStatus({ orderId: 10, status: "paid" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("valida nome de produto antes de chamar o banco", async () => {
    await expect(appRouter.createCaller(context("admin")).catalog.createProduct({ name: "", description: "Bolo", price: "20" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.createProduct).not.toHaveBeenCalled();
  });
});
