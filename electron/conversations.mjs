import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ID_PATTERN = /^[0-9a-f-]{36}$/;

function conversationFile(folder, id) {
  if (!ID_PATTERN.test(id)) throw new Error("Invalid conversation id");
  return path.join(folder, `${id}.json`);
}

export function createConversation() {
  return { id: randomUUID(), title: "Neue Unterhaltung", updatedAt: Date.now(), summary: null, messages: [] };
}

export async function loadConversation(folder, id) {
  return JSON.parse(await readFile(conversationFile(folder, id), "utf8"));
}

export async function saveConversation(folder, conversation) {
  await mkdir(folder, { recursive: true });
  const updated = { ...conversation, updatedAt: Date.now() };
  await writeFile(conversationFile(folder, conversation.id), JSON.stringify(updated), "utf8");
  return updated;
}

export function deleteConversation(folder, id) {
  return rm(conversationFile(folder, id), { force: true });
}

export async function listConversations(folder) {
  const names = await readdir(folder).catch(() => []);
  const items = await Promise.all(
    names.map(async (name) => {
      const file = path.join(folder, name);
      const { size: bytes, mtimeMs: updatedAt } = await stat(file);
      try {
        const { title, id, messages } = JSON.parse(await readFile(file, "utf8"));
        return { id, title, updatedAt, messageCount: messages.length, bytes };
      } catch {
        // Too large or damaged to parse, but it must stay deletable.
        const id = path.basename(name, ".json");
        return { id, title: "Nicht lesbare Unterhaltung", updatedAt, messageCount: 0, bytes };
      }
    }),
  );
  return items.sort((a, b) => b.updatedAt - a.updatedAt);
}
