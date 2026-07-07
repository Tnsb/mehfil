/**
 * Passwordless auth: email + 6-digit code.
 * Dev: the code is printed to the server console (and surfaced in the UI when
 * not in production). Swap `sendCode` for Resend/Twilio later.
 */
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, tables } from "@/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { newId, newToken } from "@/lib/ids";
import type { User } from "@/db/schema";

const SESSION_COOKIE = "table_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_TTL_MS = 10 * 60 * 1000;

export async function requestLoginCode(
  email: string,
): Promise<{ devCode?: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.insert(tables.authCodes).values({
    id: newId("ac"),
    email: email.toLowerCase().trim(),
    code,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  // Delivery point: replace with a real email send later.
  console.log(`\n  ✉️  TABLE login code for ${email}: ${code}\n`);
  return process.env.NODE_ENV !== "production" ? { devCode: code } : {};
}

export async function verifyLoginCode(
  email: string,
  code: string,
  name?: string,
): Promise<User | null> {
  const normalized = email.toLowerCase().trim();
  const [match] = await db
    .select()
    .from(tables.authCodes)
    .where(
      and(
        eq(tables.authCodes.email, normalized),
        eq(tables.authCodes.code, code.trim()),
        gt(tables.authCodes.expiresAt, new Date()),
        isNull(tables.authCodes.consumedAt),
      ),
    );
  if (!match) return null;

  await db
    .update(tables.authCodes)
    .set({ consumedAt: new Date() })
    .where(eq(tables.authCodes.id, match.id));

  let [user] = await db.select().from(tables.users).where(eq(tables.users.email, normalized));
  if (!user) {
    [user] = await db
      .insert(tables.users)
      .values({ id: newId("usr"), email: normalized, name: name?.trim() || null })
      .returning();
  } else if (name?.trim() && !user.name) {
    [user] = await db
      .update(tables.users)
      .set({ name: name.trim() })
      .where(eq(tables.users.id, user.id))
      .returning();
  }

  const token = newToken();
  await db.insert(tables.sessions).values({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
  return user;
}

/** Current user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ user: tables.users })
    .from(tables.sessions)
    .innerJoin(tables.users, eq(tables.sessions.userId, tables.users.id))
    .where(and(eq(tables.sessions.token, token), gt(tables.sessions.expiresAt, new Date())));
  return row?.user ?? null;
});

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(tables.sessions).where(eq(tables.sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}
