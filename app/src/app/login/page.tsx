import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(next || "/");

  return (
    <Shell>
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="font-display text-4xl font-semibold mb-1">Pull up a chair</h1>
        <p className="text-[color:var(--color-ink-soft)] mb-6">
          No passwords — we&apos;ll email you a code.
        </p>
        <LoginForm next={next || "/"} />
      </div>
    </Shell>
  );
}
