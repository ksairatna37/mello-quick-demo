import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");

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

  const { messages, max_completion_tokens = 300 } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid payload. 'messages' must be a non-empty array." });
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
        messages,
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

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
