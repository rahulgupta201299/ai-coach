"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

type Msg = { role: "user" | "assistant"; content: string };
type Conversation = { id: string; title: string; updatedAt: number; messages: Msg[] };

const COACH = process.env.NEXT_PUBLIC_COACH_NAME || "Coach Meera";
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || "Clarity Coaching";
const STORAGE_KEY = "coach-chatbot:conversations";

const STARTERS = [
  "I feel stuck in my career and don't know what to do next",
  "I'm overwhelmed with too many tasks",
  "How do I stop doubting myself at work?",
  "What coaching programs do you offer?",
];

// ---- tiny localStorage helpers (wrapped: storage can be unavailable) ----
function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}
function saveConversations(list: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* ignore */
  }
}
const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function Chat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = loadConversations();
    setConversations(list);
    if (list[0]) setActiveId(list[0].id);
  }, []);

  const active = conversations.find((c) => c.id === activeId) || null;
  const messages = active?.messages || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  function update(id: string, fn: (c: Conversation) => Conversation) {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? fn(c) : c)).sort((a, b) => b.updatedAt - a.updatedAt);
      saveConversations(next);
      return next;
    });
  }

  function startNew() {
    abortRef.current?.abort();
    setActiveId(null);
    setInput("");
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveConversations(next);
      return next;
    });
    if (id === activeId) setActiveId(null);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;

    let convId = activeId;
    const userMsg: Msg = { role: "user", content };
    const history = [...messages, userMsg];

    if (!convId) {
      convId = newId();
      const conv: Conversation = {
        id: convId,
        title: content.slice(0, 48),
        updatedAt: Date.now(),
        messages: [userMsg, { role: "assistant", content: "" }],
      };
      setConversations((prev) => {
        const next = [conv, ...prev];
        saveConversations(next);
        return next;
      });
      setActiveId(convId);
    } else {
      update(convId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        messages: [...history, { role: "assistant", content: "" }],
      }));
    }

    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const id = convId;
    const setReply = (reply: string) =>
      update(id, (c) => {
        const msgs = [...c.messages];
        msgs[msgs.length - 1] = { role: "assistant", content: reply };
        return { ...c, messages: msgs, updatedAt: Date.now() };
      });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setReply(`_${err.error || "Something went wrong. Please try again."}_`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setReply(reply);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setReply("_Connection problem. Please try again._");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="app">
      {/* Sidebar: saved conversations */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <span className="brand">{BRAND}</span>
          <button className="icon-btn close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <button className="new-chat" onClick={startNew}>
          + New conversation
        </button>
        <div className="history-label">Past conversations</div>
        <ul className="history">
          {conversations.length === 0 && <li className="history-empty">Nothing here yet.</li>}
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? "active" : ""}>
              <button
                className="history-item"
                onClick={() => {
                  setActiveId(c.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="history-title">{c.title}</span>
                <span className="history-date">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </button>
              <button className="icon-btn delete" onClick={() => deleteConversation(c.id)} aria-label="Delete conversation">
                🗑
              </button>
            </li>
          ))}
        </ul>
        <p className="sidebar-note">Conversations are saved on this device only.</p>
      </aside>
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat */}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu" onClick={() => setSidebarOpen(true)} aria-label="Open conversations">
            ☰
          </button>
          <div className="avatar">{COACH.split(" ").pop()?.[0] || "C"}</div>
          <div>
            <div className="coach-name">{COACH}&apos;s AI Coach</div>
            <div className="coach-sub">Here to help you think things through</div>
          </div>
          <button className="icon-btn new-top" onClick={startNew} aria-label="New conversation">
            ✎
          </button>
        </header>

        <div className="messages">
          {messages.length === 0 ? (
            <div className="welcome">
              <h1>What&apos;s on your mind today?</h1>
              <p>
                I can help with clarity &amp; goals, career transitions, confidence, productivity and work–life
                balance — using {COACH}&apos;s coaching approach.
              </p>
              <div className="starters">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>
                  {m.role === "assistant" ? (
                    m.content ? (
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    ) : (
                      <span className="typing">
                        <i />
                        <i />
                        <i />
                      </span>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Type your message…"
            rows={1}
            maxLength={4000}
          />
          {loading ? (
            <button type="button" className="send stop" onClick={() => abortRef.current?.abort()}>
              Stop
            </button>
          ) : (
            <button type="submit" className="send" disabled={!input.trim()}>
              Send
            </button>
          )}
        </form>
        <p className="disclaimer">
          AI assistant, not a therapist. In a crisis in India call Tele-MANAS <b>14416</b> or emergency <b>112</b>.
        </p>
      </main>
    </div>
  );
}
