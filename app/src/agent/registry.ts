/**
 * The tool registry — the single choke point for ALL actions in the app.
 *
 * The SAME tool definitions serve three callers:
 *   1. The human UI     → server actions call `runTool(name, ctx, input)`
 *   2. The chat agent   → `src/agent/chat.ts` adapts the registry for the AI SDK
 *   3. The scheduler    → cron calls tools with `SYSTEM_CONTEXT`
 *
 * Authorization lives INSIDE each tool (via ActorContext), so the agent can
 * never do something the UI couldn't. Adding a feature = one new tool file in
 * src/agent/tools/ + one line in tools/index.ts.
 */
import { allTools } from "./tools";
import { err, ToolError, type ActorContext, type AnyTool, type ToolResult } from "./types";

export * from "./types";

const registry = new Map<string, AnyTool>();
for (const tool of allTools) registry.set(tool.name, tool);

export function getTool(name: string): AnyTool | undefined {
  return registry.get(name);
}

export function listTools(): AnyTool[] {
  return [...registry.values()];
}

export async function runTool(
  name: string,
  ctx: ActorContext,
  rawInput: unknown,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) return err(`Unknown tool: ${name}`);

  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      `Invalid input for ${name}: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  try {
    return await tool.execute(ctx, parsed.data as never);
  } catch (e) {
    if (e instanceof ToolError) return err(e.message);
    console.error(`[tool:${name}] failed`, e);
    return err("Something went wrong running that action.");
  }
}
