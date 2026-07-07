import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { NewEventForm } from "./event-form";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/host/new");

  return (
    <Shell>
      <div className="mx-auto max-w-xl px-4 py-8">
        <h1 className="font-display text-4xl font-semibold mb-1">Set a table</h1>
        <p className="text-[color:var(--color-ink-soft)] mb-6">
          It starts as a draft — publish when it looks right.
        </p>
        <NewEventForm />
      </div>
    </Shell>
  );
}
