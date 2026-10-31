"use client";

import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import type { ChatMessage, Conversation, ConversationSummary } from "@/types/desktop";

const GIGABYTE = 1024 ** 3;
const NOTICE_BYTES = GIGABYTE;
const CRITICAL_BYTES = 5 * GIGABYTE;

function formatBytes(bytes: number) {
  if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function MessageBody({ text, onApply }: { text: string; onApply: (code: string) => void }) {
  // Odd parts are the contents of fenced code blocks.
  return text.split("```").map((part, index) => {
    if (index % 2 === 0) return <p key={index} className="whitespace-pre-wrap">{part.trim()}</p>;
    const code = part.replace(/^[a-z]*\n/i, "").trimEnd();
    return (
      <div key={index} className="my-2 rounded border border-line">
        <pre className="max-h-48 overflow-auto p-2 font-mono text-[11px]">{code}</pre>
        <button
          type="button"
          onClick={() => onApply(code)}
          className="w-full border-t border-line p-1 text-xs text-accent hover:bg-canvas"
        >
          Übernehmen
        </button>
      </div>
    );
  });
}

interface ChatPanelProps {
  projectName: string | null;
  getContext: () => string;
  onApply: (code: string) => void;
}

export function ChatPanel({ projectName, getContext, onApply }: ChatPanelProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    const [configured, list] = await Promise.all([api.aiConfigured(), api.listConversations()]);
    setIsConfigured(configured);
    setConversations(list);
  }, []);

  useEffect(() => {
    // refresh only sets state after awaiting the main process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    return getDesktopApi()?.onAiToken((token) =>
      setPendingReply((reply) => (reply ?? "") + token),
    );
  }, [refresh, projectName]);

  const totalBytes = conversations.reduce((sum, item) => sum + item.bytes, 0);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch {
      setError("Die KI konnte nicht antworten. Prüfe Server und Modell.");
    }
  }

  async function configure() {
    await run(async () => {
      await getDesktopApi()?.configureAi();
      await refresh();
    });
  }

  async function send() {
    const api = getDesktopApi();
    const text = input.trim();
    if (!api || !text) return;
    setInput("");
    const conversation = current ?? (await api.createConversation());
    const message: ChatMessage = { role: "user", content: text };
    setCurrent({ ...conversation, messages: [...conversation.messages, message] });
    setPendingReply("");
    await run(async () => {
      setCurrent(await api.sendMessage(conversation.id, text, getContext()));
    });
    setPendingReply(null);
    await refresh();
  }

  async function compress() {
    const api = getDesktopApi();
    if (!api || !current) return;
    setIsCompressing(true);
    await run(async () => {
      setCurrent(await api.compressConversation(current.id));
      await refresh();
    });
    setIsCompressing(false);
  }

  async function remove(item: ConversationSummary) {
    if (!window.confirm(`„${item.title}“ endgültig löschen?`)) return;
    await getDesktopApi()?.deleteConversation(item.id);
    if (current?.id === item.id) setCurrent(null);
    await refresh();
  }

  async function open(id: string) {
    const conversation = await getDesktopApi()?.loadConversation(id);
    if (conversation) setCurrent(conversation);
  }

  if (!isConfigured) {
    return (
      <div className="p-3 text-xs text-muted">
        <p className="mb-3">
          Wähle dafür <code>llama-server</code> und ein GGUF-Modell auf diesem Rechner. Alles bleibt lokal.
        </p>
        <button type="button" onClick={configure} className="rounded bg-accent px-3 py-1.5 font-medium text-canvas">
          Lokale KI einrichten
        </button>
        {error && <p role="alert" className="mt-2 text-red-400">{error}</p>}
      </div>
    );
  }

  const isBusy = pendingReply !== null || isCompressing;
  const storageBanner =
    totalBytes >= CRITICAL_BYTES
      ? `Unterhaltungen belegen ${formatBytes(totalBytes)}. Das ist sehr viel, bitte lösche alte Unterhaltungen.`
      : totalBytes >= NOTICE_BYTES
        ? `Unterhaltungen belegen ${formatBytes(totalBytes)}.`
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      {storageBanner && (
        <p
          role="alert"
          className={`border-b border-line p-2 ${totalBytes >= CRITICAL_BYTES ? "text-red-400" : "text-amber-400"}`}
        >
          {storageBanner}
        </p>
      )}

      {!current ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {conversations.length === 0 && <p className="p-3 text-muted">Noch keine Unterhaltungen.</p>}
          {conversations.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-line px-3 py-2">
              <button type="button" onClick={() => open(item.id)} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                {item.title}
              </button>
              <span className="shrink-0 text-muted">{formatBytes(item.bytes)}</span>
              <button
                type="button"
                aria-label={`${item.title} löschen`}
                onClick={() => remove(item)}
                className="shrink-0 text-muted hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 border-b border-line px-3 py-2">
            <button type="button" onClick={() => setCurrent(null)} className="text-muted hover:text-accent">
              ← Alle
            </button>
            <button
              type="button"
              disabled={isBusy || current.messages.length < 6}
              onClick={compress}
              className="ml-auto text-muted hover:text-accent disabled:opacity-40"
            >
              {isCompressing ? "Komprimiert..." : "Komprimieren"}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {current.summary && (
              <p className="mb-3 rounded bg-surface p-2 text-muted">Zusammenfassung: {current.summary}</p>
            )}
            {current.messages.map((message, index) => (
              <div key={index} className={`mb-3 ${message.role === "user" ? "text-accent" : ""}`}>
                <MessageBody text={message.content} onApply={onApply} />
              </div>
            ))}
            {pendingReply !== null && <MessageBody text={pendingReply || "Denkt nach..."} onApply={onApply} />}
          </div>
        </>
      )}

      {error && <p role="alert" className="px-3 pb-1 text-red-400">{error}</p>}
      <div className="border-t border-line p-2">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!isBusy) send();
            }
          }}
          rows={3}
          placeholder="Frag die lokale KI"
          aria-label="Nachricht an die KI"
          className="w-full resize-none rounded border border-line bg-transparent p-2 outline-none focus:border-accent"
        />
        {isBusy && pendingReply !== null ? (
          <button type="button" onClick={() => getDesktopApi()?.cancelAi()} className="text-muted hover:text-accent">
            Antwort stoppen
          </button>
        ) : (
          <button type="button" onClick={() => setCurrent(null)} className="text-muted hover:text-accent">
            + Neue Unterhaltung
          </button>
        )}
      </div>
    </div>
  );
}
