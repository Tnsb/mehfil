"use server";

/**
 * Server actions — the human UI's thin bridge into the tool registry.
 * No business logic lives here: every action builds the caller's
 * ActorContext and calls runTool, exactly like the chat agent does.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { runTool, type ActorContext, type ToolResult } from "@/agent/registry";
import {
  getCurrentUser,
  requestLoginCode,
  verifyLoginCode,
  signOut as authSignOut,
} from "@/lib/auth";

async function ctxOrNull(): Promise<ActorContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return { userId: user.id, name: user.name ?? user.email, isSystem: false };
}

/* ---------------- auth ---------------- */

export async function sendCodeAction(email: string): Promise<{ devCode?: string; error?: string }> {
  if (!email || !email.includes("@")) return { error: "Enter a valid email." };
  return await requestLoginCode(email);
}

export async function verifyCodeAction(
  email: string,
  code: string,
  name: string,
  next: string,
): Promise<{ error?: string }> {
  const user = await verifyLoginCode(email, code, name);
  if (!user) return { error: "That code didn't match (or expired). Try again." };
  redirect(next || "/");
}

export async function signOutAction(): Promise<void> {
  await authSignOut();
  redirect("/");
}

/* ---------------- tools (generic bridge) ---------------- */

export async function toolAction(
  name: string,
  input: unknown,
  revalidate?: string[],
): Promise<ToolResult> {
  const ctx = await ctxOrNull();
  if (!ctx) return { ok: false, error: "You need to sign in first." };
  const result = await runTool(name, ctx, input);
  if (result.ok) for (const path of revalidate ?? []) revalidatePath(path);
  return result;
}

/* ---------------- notifications ---------------- */

export async function markNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(tables.notifications)
    .set({ readAt: new Date() })
    .where(eq(tables.notifications.userId, user.id));
  revalidatePath("/inbox");
}
