import type { UIMessage } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { streamAgentResponse, hasLlmKey } from "@/agent/chat";
import { streamMockResponse } from "@/agent/mock";
import type { ActorContext } from "@/agent/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const user = await getCurrentUser();

  const ctx: ActorContext = {
    userId: user?.id ?? null,
    name: user?.name ?? user?.email ?? null,
    isSystem: false,
  };

  return hasLlmKey()
    ? await streamAgentResponse(ctx, messages)
    : streamMockResponse(ctx, messages);
}
