"use client";

import { FormEvent, useState } from "react";

const NAV_ITEMS = [
  "HOME",
  "AI CHAT",
  "AGENTS",
  "SWARM",
  "WORKFLOWS",
  "KNOWLEDGE",
  "DOCUMENTS",
  "PROJECTS",
  "MEMORY",
  "TASKS",
  "API",
  "INTEGRATIONS",
  "BLOCKCHAIN",
  "ANALYTICS",
  "SETTINGS",
  "ADMIN",
  "SECURITY",
  "AUDIT",
  "SYSTEM"
];

interface DashboardProps {
  homeData: {
    activeProjects: number;
    agents: number;
    runningTasks: number;
    monthlyCost: number;
    blockchainStatus: { configured: boolean; message: string };
  };
}

export function Dashboard({ homeData }: DashboardProps) {
  const [chatOutput, setChatOutput] = useState<string>("");
  const [lastApiKey, setLastApiKey] = useState<string | null>(null);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.reload();
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await fetch("/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: String(formData.get("name")), description: String(formData.get("description") || "") })
    });
    window.location.reload();
  }

  async function runChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChatOutput("");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: String(formData.get("model") || "gpt-4o-mini"),
        prompt: String(formData.get("prompt") || "")
      })
    });

    if (!response.ok || !response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n").filter((line) => line.startsWith("data: "));
      for (const line of lines) {
        const payload = JSON.parse(line.slice(6));
        if (payload.type === "chunk") {
          setChatOutput((prev) => prev + payload.chunk);
        }
      }
    }
  }

  async function createApiKey() {
    const response = await fetch("/api/v1/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "default", scope: ["projects.read", "agents.execute"] })
    });

    if (!response.ok) return;
    const body = await response.json();
    setLastApiKey(body.key.secret);
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-900/60 p-4 lg:block">
        <div className="mb-4 text-lg font-semibold text-cyan-200">ZYNVEX</div>
        <nav className="space-y-1 text-xs text-slate-300">
          {NAV_ITEMS.map((item) => (
            <div key={item} className="rounded-md px-2 py-2 hover:bg-white/10">
              {item}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Enterprise Dashboard</h1>
          <button onClick={logout} className="rounded-md border border-white/20 px-3 py-2 text-sm">Logout</button>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Active Projects" value={String(homeData.activeProjects)} />
          <Card title="Agents" value={String(homeData.agents)} />
          <Card title="Running Tasks" value={String(homeData.runningTasks)} />
          <Card title="Monthly Cost" value={`$${homeData.monthlyCost}`} />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="Token / Blockchain Status">
            <p className="text-sm">{homeData.blockchainStatus.message}</p>
          </Panel>

          <Panel title="Quick Actions">
            <form className="space-y-2" onSubmit={createProject}>
              <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm" name="name" placeholder="New project name" required />
              <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm" name="description" placeholder="Description" />
              <button className="rounded-md bg-cyan-500 px-3 py-2 text-sm text-white" type="submit">Create Project</button>
            </form>
          </Panel>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <Panel title="AI Chat">
            <form className="space-y-2" onSubmit={runChat}>
              <input className="w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm" name="model" placeholder="Model (gpt-4o-mini, claude..., gemini...)" defaultValue="gpt-4o-mini" />
              <textarea className="min-h-24 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm" name="prompt" placeholder="Ask something..." required />
              <button className="rounded-md bg-cyan-500 px-3 py-2 text-sm text-white" type="submit">Send</button>
            </form>
            <pre className="mt-3 whitespace-pre-wrap rounded-md bg-black/30 p-3 text-xs text-cyan-100">{chatOutput || "No response yet"}</pre>
          </Panel>

          <Panel title="API Key Management">
            <button className="rounded-md bg-cyan-500 px-3 py-2 text-sm text-white" onClick={createApiKey}>Create API Key</button>
            <p className="mt-3 text-xs text-slate-300">Secret (shown once): {lastApiKey ?? "not created"}</p>
          </Panel>
        </section>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-cyan-100">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <h2 className="mb-3 text-sm font-medium text-cyan-200">{title}</h2>
      {children}
    </div>
  );
}
