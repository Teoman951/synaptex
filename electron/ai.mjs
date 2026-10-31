import { spawn } from "node:child_process";
import { createServer } from "node:net";

const CONTEXT_SIZE = "4096";
const START_TIMEOUT_MS = 120_000;

let server = null;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilHealthy(port) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const healthy = await fetch(`http://127.0.0.1:${port}/health`)
      .then((response) => response.ok)
      .catch(() => false);
    if (healthy) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Model server did not start");
}

export function stopServer() {
  server?.process.kill();
  server = null;
}

// The server only listens on loopback, so documents never leave the machine.
async function ensureServer({ serverPath, modelPath }) {
  if (server?.modelPath === modelPath) return server.port;
  stopServer();

  const port = await findFreePort();
  const process = spawn(
    serverPath,
    ["-m", modelPath, "--host", "127.0.0.1", "--port", String(port), "-c", CONTEXT_SIZE],
    { stdio: "ignore", windowsHide: true },
  );
  process.once("exit", () => {
    if (server?.process === process) server = null;
  });
  server = { process, port, modelPath };
  await waitUntilHealthy(port);
  return port;
}

// Streams a chat completion and resolves to the full reply.
export async function complete(settings, messages, { signal, onToken = () => {} }) {
  const port = await ensureServer(settings);
  const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, stream: true, temperature: 0.3 }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`Model server: ${response.status}`);

  let reply = "";
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
      const token = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
      if (token) {
        reply += token;
        onToken(token);
      }
    }
  }
  return reply;
}
