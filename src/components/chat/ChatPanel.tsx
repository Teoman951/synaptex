"use client";

import { useCallback, useEffect, useState } from "react";
import { ModelPicker } from "@/components/chat/ModelPicker";
import { getDesktopApi } from "@/lib/desktop";
import { diffLines } from "@/lib/lineDiff";
import type { ChatMessage, Conversation, ConversationSummary } from "@/types/desktop";

const GIGABYTE = 1024 ** 3;
const NOTICE_BYTES = GIGABYTE;
// Mirrors electron/ai.mjs and promptFor in electron/main.mjs.
const CONTEXT_TOKENS = 4096;
const RECENT_MESSAGES = 8;
const MAX_CONTEXT_CHARS = 6000;
const SYSTEM_PROMPT_CHARS = 200;
const CHARS_PER_TOKEN = 4;
const CRITICAL_BYTES = 5 * GIGABYTE;

// A rough estimate: the real token count depends on the model.
function contextShare(conversation: Conversation, context: string) {
  const messageChars = conversation.messages
    .slice(-RECENT_MESSAGES)
    .reduce((sum, message) => sum + message.content.length, 0);
  const chars =
    SYSTEM_PROMPT_CHARS +
    messageChars +
    (conversation.summary?.length ?? 0) +
    Math.min(context.length, MAX_CONTEXT_CHARS);
  return Math.min(1, chars / CHARS_PER_TOKEN / CONTEXT_TOKENS);
}

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

const DIFF_STYLES = {
  same: "text-muted",
  removed: "bg-red-500/15 text-red-300",
  added: "bg-green-500/15 text-green-300",
};
const DIFF_PREFIX = { same: " ", removed: "-", added: "+" };

interface ProposalProps {
  before: string;
  after: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Proposal({ before, after, onConfirm, onCancel }: ProposalProps) {
  return (
    <div className="border-t border-line p-2">
      <p className="mb-1 font-medium">
        {before ? "Markierung ersetzen" : "Am Cursor einfügen"}
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-line font-mono text-[11px]">
        {diffLines(before, after).map((line, index) => (
          <div key={index} className={DIFF_STYLES[line.type]}>
            {DIFF_PREFIX[line.type]} {line.text}
          </div>
        ))}
      </pre>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onConfirm} className="rounded bg-accent px-2 py-1 font-medium text-canvas">
          Anwenden
        </button>
        <button type="button" onClick={onCancel} className="text-muted hover:text-accent">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  projectName: string | null;
  getContext: () => string;
  getSelection: () => string;
  onApply: (code: string) => void;
}

export function ChatPanel({ projectName, getContext, getSelection, onApply }: ChatPanelProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ before: string; after: string } | null>(null);

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

  function propose(code: string) {
    setProposal({ before: getSelection(), after: code });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch {
      setError("Die KI konnte nicht antworten. Prüfe Server und Modell.");
    }
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
    const question = "Ältere Nachrichten werden durch eine KI-Zusammenfassung ersetzt und endgültig entfernt. Fortfahren?";
    if (!window.confirm(question)) return;
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
      <div className="flex min-h-0 flex-1 flex-col">
        <ModelPicker onChange={refresh} />
        <p className="p-3 text-xs text-muted">
          Wähle ein Modell und <code>llama-server</code> aus. Alles bleibt auf diesem Rechner.
        </p>
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
      <ModelPicker onChange={refresh} />
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
            <span title="Grobe Schätzung des belegten Kontextfensters" className="flex items-center gap-1 text-muted">
              Kontext {Math.round(contextShare(current, getContext()) * 100)} %
              <span className="h-1 w-16 overflow-hidden rounded bg-surface">
                <span
                  className="block h-full bg-accent"
                  style={{ width: `${contextShare(current, getContext()) * 100}%` }}
                />
              </span>
            </span>
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
                <MessageBody text={message.content} onApply={propose} />
              </div>
            ))}
            {pendingReply !== null && <MessageBody text={pendingReply || "Denkt nach..."} onApply={propose} />}
          </div>
        </>
      )}

      {error && <p role="alert" className="px-3 pb-1 text-red-400">{error}</p>}
      {proposal && (
        <Proposal
          before={proposal.before}
          after={proposal.after}
          onConfirm={() => {
            onApply(proposal.after);
            setProposal(null);
          }}
          onCancel={() => setProposal(null)}
        />
      )}
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
