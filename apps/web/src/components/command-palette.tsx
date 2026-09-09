"use client";

import { useEffect, useState } from "react";

const COMMANDS = [
  "New Chat",
  "New Agent",
  "New Workflow",
  "New Project",
  "Search",
  "Upload",
  "Settings",
  "API Keys",
  "Security",
  "Wallet"
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-xl border border-white/15 bg-slate-900/90 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-sm font-semibold text-cyan-200">Command Center</div>
        <ul className="space-y-1 text-sm">
          {COMMANDS.map((command) => (
            <li key={command} className="rounded-md px-3 py-2 text-slate-200 hover:bg-white/10">
              {command}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
