"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "./Logo";
import { IconAlert, IconLock } from "./icons";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Sign in failed. Try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-180px] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[120px]" />
        <div className="absolute bottom-[-220px] right-[-80px] h-[420px] w-[520px] rounded-full bg-cyan-400/15 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="h-14 w-14" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-strong">Sign in to Visitas</h1>
            <p className="mt-1 text-sm text-muted">Privacy-first web analytics dashboard</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">
              Username
            </span>
            <input
              className="input"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-faint">
              Password
            </span>
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? (
            <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
              <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            <IconLock className="h-4 w-4" />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
