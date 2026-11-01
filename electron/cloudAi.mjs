import Anthropic from "@anthropic-ai/sdk";

export const PROVIDERS = {
  anthropic: { name: "Claude (Anthropic)", defaultModel: "claude-opus-5-5" },
  openai: {
    name: "ChatGPT (OpenAI)",
    defaultModel: "",
    url: "https://api.openai.com/v1/chat/completions",
  },
  google: {
    name: "Gemini (Google)",
    defaultModel: "",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
};

async function completeAnthropic({ apiKey, model }, messages, { signal, onToken }) {
  const client = new Anthropic({ apiKey });
  const system = messages.filter(({ role }) => role === "system").map(({ content }) => content).join("\n\n");
  const stream = client.beta.messages.stream(
    {
      model,
      max_tokens: 64000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system,
      messages: messages.filter(({ role }) => role !== "system"),
    },
    { signal },
  );
  stream.on("text", onToken);
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined this request");
  return message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

// OpenAI and Gemini share this streaming format.
async function completeChatCompletions({ apiKey, model, url }, messages, { signal, onToken }) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!response.ok || !response.body) throw new Error(`Provider: ${response.status}`);

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

export function completeCloud(config, messages, { signal, onToken = () => {} }) {
  const provider = PROVIDERS[config.provider];
  if (!provider) throw new Error("Unknown provider");
  return config.provider === "anthropic"
    ? completeAnthropic(config, messages, { signal, onToken })
    : completeChatCompletions({ url: provider.url, ...config }, messages, { signal, onToken });
}
