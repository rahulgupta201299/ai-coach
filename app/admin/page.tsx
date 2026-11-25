"use client";

import { useState } from "react";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [knowledge, setKnowledge] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<"knowledge" | "instructions">("knowledge");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setStatus("Checking…");
    const res = await fetch("/api/admin", { headers: { "x-admin-password": password } });
    if (!res.ok) {
      setStatus("Wrong password (or ADMIN_PASSWORD not set in .env.local).");
      return;
    }
    const data = await res.json();
    setKnowledge(data.knowledge);
    setInstructions(data.instructions);
    setAuthed(true);
    setStatus("");
  }

  async function save() {
    setStatus("Saving…");
    const res = await fetch("/api/admin", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ knowledge, instructions }),
    });
    const data = await res.json().catch(() => ({}));
    setStatus(res.ok ? "Saved ✓ — the chatbot uses the new content immediately." : data.error || "Save failed.");
  }

  if (!authed) {
    return (
      <div className="admin">
        <form className="admin-login" onSubmit={login}>
          <h1>Coach admin</h1>
          <p>Edit the chatbot&apos;s knowledge base and coaching instructions.</p>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          <button type="submit">Sign in</button>
          {status && <p className="admin-status">{status}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <div className="admin-panel">
        <div className="admin-head">
          <h1>Coach admin</h1>
          <a href="/">← Back to chat</a>
        </div>
        <div className="tabs">
          <button className={tab === "knowledge" ? "on" : ""} onClick={() => setTab("knowledge")}>
            Knowledge base (context)
          </button>
          <button className={tab === "instructions" ? "on" : ""} onClick={() => setTab("instructions")}>
            Coaching instructions
          </button>
        </div>
        <p className="hint">
          {tab === "knowledge"
            ? "The chatbot answers ONLY from this text: your frameworks, focus areas, programs, prices, policies, FAQs. Markdown is fine."
            : "How the chatbot should talk: tone, coaching style, length of replies, when to suggest programs."}
        </p>
        <textarea
          className="editor"
          value={tab === "knowledge" ? knowledge : instructions}
          onChange={(e) => (tab === "knowledge" ? setKnowledge(e.target.value) : setInstructions(e.target.value))}
          spellCheck={false}
        />
        <div className="admin-actions">
          <button onClick={save}>Save changes</button>
          <span className="admin-status">{status}</span>
        </div>
      </div>
    </div>
  );
}
