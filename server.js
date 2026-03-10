import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import { WebSocket, WebSocketServer } from "ws";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const DEFAULT_SYSTEM_PROMPT =
  "You are Mello, a compassionate, trauma-informed mental health companion. Be empathetic, supportive, concise, and safety-first. Do not provide medical diagnosis. If user mentions self-harm or crisis, respond with care and encourage immediate professional help or crisis resources.";

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || process.env.VITE_AZURE_OPENAI_ENDPOINT;
  const azureApiKey = process.env.AZURE_OPENAI_KEY || process.env.VITE_AZURE_OPENAI_KEY;
  const azureDeployment =
    process.env.AZURE_DEPLOYMENT_NAME || process.env.VITE_AZURE_DEPLOYMENT_NAME || "gpt-5.2-chat";
  const azureApiVersion =
    process.env.AZURE_API_VERSION || process.env.VITE_AZURE_API_VERSION || "2024-12-01-preview";

  if (!azureEndpoint || !azureApiKey) {
    return res.status(500).json({
      error: "Missing server config. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_KEY.",
    });
  }

  const systemPrompt = process.env.MELLO_SYSTEM_PROMPT;
  const { messages, max_completion_tokens = 300 } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid payload. 'messages' must be a non-empty array." });
  }

  const safeMessages = messages
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
    .map((msg) => ({ role: msg.role, content: String(msg.content ?? "") }))
    .filter((msg) => msg.content.trim().length > 0);

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: "Invalid payload. No valid chat messages found." });
  }

  try {
    const cleanEndpoint = azureEndpoint.replace(/\/+$/, "");
    const url = `${cleanEndpoint}/openai/deployments/${azureDeployment}/chat/completions?api-version=${azureApiVersion}`;

    const azureResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": azureApiKey,
      },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
        max_completion_tokens,
      }),
    });

    const text = await azureResponse.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!azureResponse.ok) {
      return res.status(azureResponse.status).json({
        error: "Azure request failed",
        details: parsed ?? text ?? null,
      });
    }

    return res.json(parsed ?? {});
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use(express.static(distDir));

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

const server = createServer(app);
const voiceWss = new WebSocketServer({ server, path: "/ws/voice" });

voiceWss.on("connection", (clientWs) => {
  const humeApiKey = process.env.HUME_API_KEY || process.env.VITE_HUME_API_KEY;
  const humeConfigId = process.env.HUME_CONFIG_ID || process.env.VITE_HUME_CONFIG_ID;

  if (!humeApiKey) {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "error", message: "Missing HUME_API_KEY on server." }));
    }
    clientWs.close();
    return;
  }

  const params = new URLSearchParams({ api_key: humeApiKey, evi_version: "3" });
  if (humeConfigId) {
    params.set("config_id", humeConfigId);
  }

  const upstreamWs = new WebSocket(`wss://api.hume.ai/v0/evi/chat?${params.toString()}`);

  upstreamWs.on("message", (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data, { binary: isBinary });
    }
  });

  upstreamWs.on("error", () => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "error", message: "Failed to connect to Hume voice service." }));
    }
  });

  upstreamWs.on("close", () => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  clientWs.on("message", (data, isBinary) => {
    if (upstreamWs.readyState === WebSocket.OPEN) {
      upstreamWs.send(data, { binary: isBinary });
    }
  });

  clientWs.on("close", () => {
    if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
      upstreamWs.close();
    }
  });

  clientWs.on("error", () => {
    if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
      upstreamWs.close();
    }
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
