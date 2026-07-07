/**
 * Tool primitives. Every capability of TABLE is a Tool: name + description +
 * Zod input schema + execute. The definition doubles as documentation — the
 * chat agent sees `description` and `inputSchema` verbatim.
 */
import { z } from "zod";

export type ActorContext = {
  /** null only for the system actor (scheduler / internal triggers) */
  userId: string | null;
  name: string | null;
  isSystem: boolean;
};

export const SYSTEM_CONTEXT: ActorContext = {
  userId: null,
  name: "system",
  isSystem: true,
};

export type ToolResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}
export function err(message: string): ToolResult<never> {
  return { ok: false, error: message };
}

/** Thrown inside tools for auth/validation failures; converted to a ToolResult. */
export class ToolError extends Error {}

export function requireUser(ctx: ActorContext): string {
  if (!ctx.userId) throw new ToolError("You need to sign in first.");
  return ctx.userId;
}

export type AnyTool = {
  name: string;
  /** Shown to the LLM verbatim — write it as documentation. */
  description: string;
  inputSchema: z.ZodType;
  /** Whether the chat agent may call this tool. */
  agentCallable: boolean;
  execute: (ctx: ActorContext, input: never) => Promise<ToolResult>;
};

export function defineTool<Schema extends z.ZodType>(tool: {
  name: string;
  description: string;
  inputSchema: Schema;
  agentCallable: boolean;
  execute: (ctx: ActorContext, input: z.infer<Schema>) => Promise<ToolResult>;
}): AnyTool {
  return tool as unknown as AnyTool;
}
