/**
 * graduateAdvisorAiService.js
 *
 * Provider-agnostic LLM caller for the Graduate Module AI Advisor.
 *
 * It deliberately REUSES the project's existing provider resolution
 * (utils/aiQuestionGenerator.resolveProvider) so the advisor talks to whichever
 * provider the platform already has configured — OpenAI, Groq, xAI Grok,
 * Anthropic, or a custom OpenAI-compatible endpoint. No new SDK or provider
 * dependency is introduced.
 *
 * API keys are read from process.env only and never leave the server. The model
 * name for the advisor can be set independently via GRADUATE_ADVISOR_MODEL
 * (falls back to AI_QUESTIONS_MODEL, then the provider default).
 */
const axios = require("axios");
const { resolveProvider } = require("../utils/aiQuestionGenerator");

const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Resolve the AI provider for the advisor. Returns null when no provider key is
 * configured — the caller must surface that as "not configured" instead of
 * pretending to answer with AI.
 */
function getAdvisorProvider() {
  const provider = resolveProvider();
  if (!provider) return null;

  const overrideModel = process.env.GRADUATE_ADVISOR_MODEL || process.env.AI_ADVISOR_MODEL;
  return {
    ...provider,
    model: overrideModel || provider.model,
  };
}

/** Human-readable provider label (used as a response `source`, never secrets). */
function providerLabel(provider) {
  if (!provider) return "not configured";
  if (provider.type === "anthropic") return `Anthropic (${provider.model})`;
  const base = String(provider.baseUrl || "");
  if (base.includes("groq.com")) return `Groq (${provider.model})`;
  if (base.includes("x.ai")) return `xAI Grok (${provider.model})`;
  if (base.includes("openai.com")) return `OpenAI (${provider.model})`;
  return `AI provider (${provider.model})`;
}

/**
 * Call the provider's chat-completions endpoint with a system instruction and
 * a validated message array. Throws on transport/HTTP errors so the caller can
 * return a retry-able error instead of a fabricated answer.
 */
async function callAdvisorLLM(provider, { system, messages, maxTokens = 800, temperature = 0.6 } = {}) {
  if (!provider) throw new Error("No AI provider configured");

  const timeout = Number(process.env.GRADUATE_ADVISOR_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const safeMessages = Array.isArray(messages) ? messages : [];

  if (provider.type === "anthropic") {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: provider.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: safeMessages,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        },
        timeout,
      }
    );
    return (res.data?.content || []).map((c) => c.text || "").join("").trim();
  }

  // OpenAI-compatible (OpenAI / Groq / xAI Grok / custom base URL).
  const endpoint = `${String(provider.baseUrl || "").replace(/\/$/, "")}/chat/completions`;
  const res = await axios.post(
    endpoint,
    {
      model: provider.model,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...safeMessages],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      timeout,
    }
  );
  return (res.data?.choices?.[0]?.message?.content || "").trim();
}

module.exports = {
  getAdvisorProvider,
  callAdvisorLLM,
  providerLabel,
  DEFAULT_TIMEOUT_MS,
};
