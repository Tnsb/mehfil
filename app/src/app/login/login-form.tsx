"use client";

import { useState, useTransition } from "react";
import { sendCodeAction, verifyCodeAction } from "@/app/actions";

export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function sendCode() {
    setError(undefined);
    startTransition(async () => {
      const res = await sendCodeAction(email);
      if (res.error) return setError(res.error);
      setDevCode(res.devCode);
      setStep("code");
    });
  }

  function verify() {
    setError(undefined);
    startTransition(async () => {
      const res = await verifyCodeAction(email, code, name, next);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="card p-6 rise-in">
      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold mb-1.5">Your name</label>
            <input
              className="field"
              placeholder="Priya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email</label>
            <input
              className="field"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={pending} type="submit">
            {pending ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          className="space-y-4"
        >
          <p className="text-sm text-[color:var(--color-ink-soft)]">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>
          {devCode ? (
            <p className="pill bg-[color:var(--color-butter-soft)] text-[color:var(--color-ink)]">
              dev mode — your code is {devCode}
            </p>
          ) : null}
          <input
            className="field text-center tracking-[0.5em] font-semibold text-xl"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
          {error ? <p className="text-sm text-[color:var(--color-tangerine-deep)] font-medium">{error}</p> : null}
          <button className="btn btn-primary w-full" disabled={pending || code.length !== 6} type="submit">
            {pending ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            className="w-full text-sm text-[color:var(--color-ink-soft)] underline underline-offset-2"
            onClick={() => setStep("email")}
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
