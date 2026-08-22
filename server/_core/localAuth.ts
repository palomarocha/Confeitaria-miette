import crypto from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { eq, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

const SESSION_COOKIE = COOKIE_NAME;
const PASSWORD_COST = 16384;
const PASSWORD_BLOCK_SIZE = 8;
const PASSWORD_PARALLELISM = 1;

function secret() { if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters"); return new TextEncoder().encode(ENV.cookieSecret); }
function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function hashPassword(password: string) { const salt = crypto.randomBytes(16); const derived = crypto.scryptSync(password, salt, 64, { N: PASSWORD_COST, r: PASSWORD_BLOCK_SIZE, p: PASSWORD_PARALLELISM }); return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`; }
function verifyPassword(password: string, stored: string) { const [algorithm, saltHex, hashHex] = stored.split("$"); if (algorithm !== "scrypt" || !saltHex || !hashHex) return false; const derived = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64, { N: PASSWORD_COST, r: PASSWORD_BLOCK_SIZE, p: PASSWORD_PARALLELISM }); const expected = Buffer.from(hashHex, "hex"); return expected.length === derived.length && crypto.timingSafeEqual(expected, derived); }
async function signSession(userId: number) { return new SignJWT({ userId, type: "local-session" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000)).sign(secret()); }
function getToken(req: Request) { return parseCookieHeader(req.headers.cookie ?? "")[SESSION_COOKIE]; }

async function ensureAuthTable() {
  const db = await getDb();
  if (!db) return null;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS miette_local_auth (userId INT NOT NULL PRIMARY KEY, passwordHash TEXT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT fk_miette_local_auth_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE)`);
  return db;
}

export async function getLocalUser(req: Request) {
  const token = getToken(req); if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    const userId = Number(payload.userId); if (!Number.isInteger(userId) || userId <= 0) return null;
    const db = await getDb(); if (!db) return null;
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1); return rows[0] ?? null;
  } catch { return null; }
}
function setSessionCookie(req: Request, res: Response, token: string) { res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: req.secure || req.headers["x-forwarded-proto"] === "https", sameSite: "lax", path: "/", maxAge: ONE_YEAR_MS }); }

export async function registerLocalUser(req: Request, res: Response) {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length < 2) return res.status(400).json({ error: "Nome inválido" });
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "E-mail inválido" });
  if (typeof password !== "string" || password.length < 6) return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
  const db = await ensureAuthTable(); if (!db) return res.status(503).json({ error: "Banco de dados não configurado" });
  const normalizedEmail = normalizeEmail(email);
  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing[0]) return res.status(409).json({ error: "Este e-mail já está cadastrado" });
  const openId = `local_${crypto.randomUUID()}`;
  const role = normalizedEmail === ENV.adminEmail ? "admin" : "user";
  const result = await db.insert(users).values({ openId, name: name.trim(), email: normalizedEmail, loginMethod: "password", role, lastSignedIn: new Date() });
  const userId = Number(result[0].insertId);
  await db.execute(sql`INSERT INTO miette_local_auth (userId, passwordHash) VALUES (${userId}, ${hashPassword(password)})`);
  setSessionCookie(req, res, await signSession(userId));
  return res.json({ success: true });
}

export async function loginLocalUser(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Informe e-mail e senha" });
  const db = await ensureAuthTable(); if (!db) return res.status(503).json({ error: "Banco de dados não configurado" });
  const normalizedEmail = normalizeEmail(email);
  const rows = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  const user = rows[0]; if (!user) return res.status(401).json({ error: "E-mail ou senha incorretos" });
  const [authRows] = await db.execute(sql`SELECT passwordHash FROM miette_local_auth WHERE userId = ${user.id} LIMIT 1`) as any;
  const storedHash = authRows?.[0]?.passwordHash as string | undefined;
  if (!storedHash || !verifyPassword(password, storedHash)) return res.status(401).json({ error: "E-mail ou senha incorretos" });
  const role = normalizedEmail === ENV.adminEmail && user.role !== "admin" ? "admin" : user.role;
  await db.update(users).set({ lastSignedIn: new Date(), role }).where(eq(users.id, user.id));
  setSessionCookie(req, res, await signSession(user.id));
  return res.json({ success: true });
}

export function logoutLocalUser(req: Request, res: Response) { res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: req.secure || req.headers["x-forwarded-proto"] === "https", sameSite: "lax", path: "/" }); return res.json({ success: true }); }
