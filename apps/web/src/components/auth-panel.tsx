"use client";

import { FormEvent, useState } from "react";

type Mode = "login" | "signup";

export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("signup");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      name: String(formData.get("name") ?? "")
    };

    const response = await fetch(`/api/v1/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json();
      setError(body.message ?? "Authentication failed");
      return;
    }

    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-6 shadow-xl backdrop-blur">
      <h1 className="text-2xl font-semibold text-white">ZYNVEX Enterprise</h1>
      <p className="mt-1 text-sm text-slate-300">Secure AI workspace access</p>

      <div className="mt-4 flex gap-2">
        <button className={`rounded-md px-3 py-2 text-sm ${mode === "signup" ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-200"}`} onClick={() => setMode("signup")}>
          Sign up
        </button>
        <button className={`rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-cyan-500 text-white" : "bg-white/10 text-slate-200"}`} onClick={() => setMode("login")}>
          Login
        </button>
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        {mode === "signup" && (
          <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white" name="name" placeholder="Full name" required />
        )}
        <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white" name="email" placeholder="Email" type="email" required />
        <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm text-white" name="password" placeholder="Password (min 12 chars)" type="password" minLength={12} required />
        <button className="w-full rounded-md bg-cyan-500 px-3 py-2 text-sm font-medium text-white" type="submit">
          {mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
    </div>
  );
}
