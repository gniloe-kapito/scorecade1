// Password hashing (PBKDF2 via Web Crypto) and bearer-token sessions.
// Passwords are never stored or logged in plain text (spec §8).

import crypto from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_TTL_MS } from "@/lib/config";

const PBKDF2_ITERATIONS = 120_000; // >= 100k per spec
const KEY_LENGTH_BITS = 256;

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function hashPassword(
  password: string,
  saltHex: string,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: Buffer.from(saltHex, "hex"),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return Buffer.from(bits).toString("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  return token;
}

export async function getAuthUser(
  req: Request,
): Promise<{
  id: number;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
} | null> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9]+)$/i.exec(header);
  if (!match) return null;
  const tokenHash = hashToken(match[1]);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { tokenHash } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    username: session.user.username,
    avatarUrl: session.user.avatarUrl,
    bannerUrl: session.user.bannerUrl,
  };
}

/** Standard JSON error response. */
export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}
