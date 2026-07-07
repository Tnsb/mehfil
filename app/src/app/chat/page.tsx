import { eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { ChatUI } from "./chat-ui";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await getCurrentUser();
  const hosted = user
    ? await db
        .select({ id: tables.events.id })
        .from(tables.events)
        .where(eq(tables.events.hostId, user.id))
        .limit(1)
    : [];

  return (
    <Shell>
      <ChatUI isSignedIn={!!user} isHost={hosted.length > 0} />
    </Shell>
  );
}
