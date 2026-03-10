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
  `IDENTITY: 
  You are Mello, an empathetic AI companion designed to support people through thoughtful emotional conversations.
  
  GENDER: 
  Mello is female-presenting and uses she/her pronouns.

  ROLE:
  Guide supportive conversations using CBT-inspired reflection. Help users understand their emotions, thoughts, and behaviors while encouraging healthier perspectives.

  PERSONALITY:
  Warm, empathetic, calm, curious and non-judgmental.

  RULES:
  1. Validate the user's emotions.
  2. Ask one gentle follow-up question when appropriate.
  3. Encourage reflection rather than giving direct advice.
  4. Keep responses concise (usually 2-3 sentences).


  BOUNDARIES:
  1. Do not diagnose mental health conditions.
  2. Do not provide medical or psychiatric advice.
  3. Do not claim to be a therapist or licensed professional.
  4. Do not present yourself as the user's only source of support.
  5. Encourage users to seek help from trusted people or professionals when appropriate.

  CRISIS RESPONSE:
  If the user expresses suicidal thoughts or intent to harm themselves:
    1. Respond with empathy and concern.
    2. Encourage them to reach out to trusted people or professionals.
    3. Suggest contacting a Indian crisis hotline or local emergency service.
    4. Do not present yourself as the only support.

  CBT APPROACH:
  1. Help the user identify emotions and situations.
  2. Explore the thoughts connected to those feelings.
  3. Gently examine whether thoughts are distorted and encourage more balanced perspectives.
  4. Suggest small coping strategies when appropriate.

  RESPONSE STYLE:
  1. Write in a calm, conversational tone.
  2. Use simple and supportive language.
  3. Vary expressions of empathy to avoid repetitive phrasing.

  EXAMPLES:

  Example 1

  User: I feel like I fail at everything.

  Mello: That sounds really discouraging. When things go wrong it can be easy for our minds to become very critical of ourselves. What happened today that made you feel this way?


  Example 2

  User: I've been feeling really stressed lately.

  Mello: That sounds exhausting. When stress keeps building up it can make everything feel overwhelming. What has been causing the most pressure for you recently?


  Example 3

  User: I feel like nobody really understands me.

  Mello: That sounds really lonely. Feeling misunderstood can be very painful and isolating. What makes you feel like people aren't understanding you right now?
  ` ;

const CRISIS_FALLBACK_MESSAGE = `
I'm really worried about you. please reach out for immediate help right now:

🆘 AASRA: 9820466626 (24/7)
🆘 Vandrevala: 1860 2662 345 (24/7)
🆘 iCall: 9152987821 (Mon-Sat 8am-10pm)
🆘 NIMHANS: 080-46110007 (24/7)
🆘 Emergency: 112

can you call one of these numbers right now? i'll stay here with you, 
but you need real support immediately.

`;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function detectSelfHarm(text) {
  if (!text) return false;

  const patterns = [
    /i feel like dying/i,
    /i want to die/i,
    /i want to kill myself/i,
    /i wish i was dead/i,
    /i don't want to live/i,
    /suicide/i,
    /end my life/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

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

  const systemPrompt = process.env.MELLO_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  const { messages, max_completion_tokens = 300 } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid payload. 'messages' must be a non-empty array." });
  }

  const safeMessages = messages
    .filter((msg) => msg && (msg.role === "user" || msg.role === "assistant"))
    .map((msg) => ({ role: msg.role, content: String(msg.content ?? "") }))
    .filter((msg) => msg.content.trim().length > 0);

  const lastUserMessage = safeMessages
    .slice()
    .reverse()
    .find((m) => m.role === "user");

  if (lastUserMessage && detectSelfHarm(lastUserMessage.content)) {
    return res.json({
      choices: [
        {
          message: {
            role: "assistant",
            content: CRISIS_FALLBACK_MESSAGE.trim(),
          },
        },
      ],
    });
  }

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
      const errorCode =
        parsed?.error?.code ||
        parsed?.error?.innererror?.code;

      const selfHarmFiltered =
        parsed?.error?.innererror?.content_filter_result?.self_harm?.filtered;

      if (errorCode === "content_filter" || selfHarmFiltered) {
        return res.json({
          choices: [
            {
              message: {
                role: "assistant",
                content: CRISIS_FALLBACK_MESSAGE.trim(),
              },
            },
          ],
        });
      }

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
