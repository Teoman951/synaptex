"use client";

import { t } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { getDesktopApi } from "@/lib/desktop";
import { diffLines } from "@/lib/lineDiff";
import type { ChatMessage, Conversation, ConversationSummary, EditorContext, EditTarget } from "@/types/desktop";

const GIGABYTE = 1024 ** 3;
const NOTICE_BYTES = GIGABYTE;
// Mirrors promptFor in electron/main.mjs.
const RECENT_MESSAGES = 8;
const SYSTEM_PROMPT_CHARS = 200;
const CHARS_PER_TOKEN = 4;
const CRITICAL_BYTES = 5 * GIGABYTE;

// A rough estimate: the real token count depends on the model.
function contextShare(conversation: Conversation, context: EditorContext) {
  const messageChars = conversation.messages
    .slice(-RECENT_MESSAGES)
    .reduce((sum, message) => sum + message.content.length, 0);
  const chars =
    SYSTEM_PROMPT_CHARS +
    messageChars +
    (conversation.summary?.length ?? 0) +
    context.text.length;
  return Math.min(1, chars / CHARS_PER_TOKEN / context.contextTokens);
}

function formatBytes(bytes: number) {
  if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

const NEW_FILE_LINE = /NEW FILE:\s*(\S+)\s*$/;

function MessageBody({
  text,
  onApply,
  onCreateFile,
}: {
  text: string;
  onApply: (code: string) => void;
  onCreateFile: (file: string, content: string) => void;
}) {
  // Odd parts are the contents of fenced code blocks.
  const parts = text.split("```");
  return parts.map((part, index) => {
    if (index % 2 === 0) return <p key={index} className="whitespace-pre-wrap">{part.trim()}</p>;
    const code = part.replace(/^[a-z]*\n/i, "").trimEnd();
    const newFile = parts[index - 1].trim().match(NEW_FILE_LINE)?.[1];
    return (
      <div key={index} className="my-2 rounded border border-line">
        <pre className="max-h-48 overflow-auto p-2 font-mono text-[11px]">{code}</pre>
        <button
          type="button"
          onClick={() => onApply(code)}
          className="w-full border-t border-line p-1 text-xs text-accent hover:bg-canvas"
        >
          {t("viewChange")}
        </button>
        {newFile && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t("createFileConfirm", { file: newFile }))) onCreateFile(newFile, code);
            }}
            className="w-full truncate border-t border-line p-1 text-xs text-accent hover:bg-canvas"
          >
            {t("createFile", { file: newFile })}
          </button>
        )}
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
  target: EditTarget;
  after: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function Proposal({ target, after, onConfirm, onCancel }: ProposalProps) {
  return (
    <div className="border-t border-line p-2">
      <p className="mb-1 font-medium">
        {t("lineTarget", {
          file: target.file,
          line: target.line,
          action: t(target.before ? "replaceText" : "insertText"),
        })}
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-line font-mono text-[11px]">
        {diffLines(target.before, after).map((line, index) => (
          <div key={index} className={DIFF_STYLES[line.type]}>
            {DIFF_PREFIX[line.type]} {line.text}
          </div>
        ))}
      </pre>
      <div className="mt-2 flex gap-3">
        <button type="button" onClick={onConfirm} className="rounded bg-accent px-2 py-1 font-medium text-canvas">
          {t("apply")}
        </button>
        <button type="button" onClick={onCancel} className="text-muted hover:text-accent">
          {t("reject")}
        </button>
      </div>
    </div>
  );
}

interface ChatPanelProps {
  projectName: string | null;
  getContext: () => EditorContext;
  getTarget: () => EditTarget | null;
  onCreateFile: (file: string, content: string) => void;
  onApply: (target: EditTarget, code: string) => boolean;
}

export function ChatPanel({ projectName, getContext, getTarget, onApply, onCreateFile }: ChatPanelProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [cloudModel, setCloudModel] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{ target: EditTarget; after: string } | null>(null);

  const refresh = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    const [configured, list] = await Promise.all([api.aiConfigured(), api.listConversations()]);
    setIsConfigured(configured);
    const cloud = await api.cloudState();
    setCloudModel(cloud.active ? cloud.model : null);
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
    const target = getTarget();
    if (target) setProposal({ target, after: code });
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t("aiFailed"));
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
    const question = t("compressConfirm");
    if (!window.confirm(question)) return;
    setIsCompressing(true);
    await run(async () => {
      setCurrent(await api.compressConversation(current.id));
      await refresh();
    });
    setIsCompressing(false);
  }

  async function remove(item: ConversationSummary) {
    if (!window.confirm(t("deleteConfirm", { title: item.title }))) return;
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
      <p className="p-3 text-xs text-muted">
        {t("setupAi")}
      </p>
    );
  }

  const isBusy = pendingReply !== null || isCompressing;
  const storageBanner =
    totalBytes >= CRITICAL_BYTES
      ? t("storageCritical", { size: formatBytes(totalBytes) })
      : totalBytes >= NOTICE_BYTES
        ? t("storageNotice", { size: formatBytes(totalBytes) })
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      {cloudModel && (
        <p className="border-b border-line p-2 text-amber-400">{t("cloudNotice", { model: cloudModel })}</p>
      )}
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
          {conversations.length === 0 && <p className="p-3 text-muted">{t("noConversations")}</p>}
          {conversations.map((item) => (
            <div key={item.id} className="flex items-center gap-2 border-b border-line px-3 py-2">
              <button type="button" onClick={() => open(item.id)} className="min-w-0 flex-1 truncate text-left hover:text-accent">
                {item.title}
              </button>
              <span className="shrink-0 text-muted">{formatBytes(item.bytes)}</span>
              <button
                type="button"
                aria-label={t("deleteLabel", { title: item.title })}
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
              {t("all")}
            </button>
            <span title={t("contextHint")} className="flex items-center gap-1 text-muted">
              {t("context", { percent: Math.round(contextShare(current, getContext()) * 100) })}
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
              {t(isCompressing ? "compressing" : "compress")}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {current.summary && (
              <p className="mb-3 rounded bg-surface p-2 text-muted">{t("summary", { text: current.summary })}</p>
            )}
            {current.messages.map((message, index) => (
              <div key={index} className={`mb-3 ${message.role === "user" ? "text-accent" : ""}`}>
                <MessageBody text={message.content} onApply={propose} onCreateFile={onCreateFile} />
              </div>
            ))}
            {pendingReply === "" && (
              <p role="status" className="flex items-center gap-1 text-muted">
                {t("thinking")}
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    aria-hidden
                    style={{ animationDelay: `${delay}ms` }}
                    className="size-1 animate-bounce rounded-full bg-accent"
                  />
                ))}
              </p>
            )}
            {pendingReply && <MessageBody text={pendingReply} onApply={propose} onCreateFile={onCreateFile} />}
          </div>
        </>
      )}

      {error && <p role="alert" className="px-3 pb-1 text-red-400">{error}</p>}
      {proposal && (
        <Proposal
          target={proposal.target}
          after={proposal.after}
          onConfirm={() => {
            const applied = onApply(proposal.target, proposal.after);
            setError(applied ? null : t("staleChange"));
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
          placeholder={t("askAi")}
          aria-label={t("aiMessage")}
          className="w-full resize-none rounded border border-line bg-transparent p-2 outline-none focus:border-accent"
        />
        {isBusy && pendingReply !== null ? (
          <button type="button" onClick={() => getDesktopApi()?.cancelAi()} className="text-muted hover:text-accent">
            {t("stopReply")}
          </button>
        ) : (
          <button type="button" onClick={() => setCurrent(null)} className="text-muted hover:text-accent">
            {t("newConversation")}
          </button>
        )}
      </div>
    </div>
  );
}
