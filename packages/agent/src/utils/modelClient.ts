import { logger } from "./logger.js";

// ─────────────────────────────────────────────────────────────
// Types for the OpenAI-compatible chat completions API
// used to communicate with Qwen3.5-27B on the Nosana endpoint
// ─────────────────────────────────────────────────────────────

/** A single message in the OpenAI-compatible chat format. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options forwarded to the model completions endpoint. */
export interface CompletionOptions {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stop?: string[];
}

/** Structured sentiment analysis result returned by analyzeSentiment. */
export interface SentimentResult {
  /** Sentiment score from -1.0 (very negative) to 1.0 (very positive). */
  score: number;
  /** Human-readable sentiment label. */
  label: "positive" | "neutral" | "negative";
  /** Model confidence from 0.0 to 1.0. */
  confidence: number;
}

/** Thrown when a model call exceeds the 30-second timeout. */
export class ModelTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelTimeoutError";
  }
}

/** Retry delay schedule in milliseconds — three escalating attempts. */
const RETRY_DELAYS = [500, 1500, 3000] as const;

/** Maximum wall-clock time for a single model request. */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Client for the Nosana-hosted Qwen3.5-27B-AWQ-4bit model.
 *
 * Wraps the OpenAI-compatible `/chat/completions` endpoint with
 * retry logic (3 attempts, exponential backoff) and a 30-second
 * per-request timeout. All calls are logged via pino.
 *
 * @example
 * ```ts
 * const client = new ModelClient("https://dashboard.nosana.com/jobs/xxx/proxy/v1");
 * const reply = await client.complete([
 *   { role: "system", content: "You are a helpful assistant." },
 *   { role: "user",   content: "Hello!" },
 * ], { temperature: 0.7 });
 * ```
 */
export class ModelClient {
  private readonly endpoint: string;
  private readonly apiKey: string | undefined;
  private readonly log = logger.child({ component: "ModelClient" });

  /**
   * @param endpoint - Base URL of the OpenAI-compatible API (e.g. Nosana proxy).
   * @param apiKey   - Optional bearer token for the Authorization header.
   */
  constructor(endpoint: string, apiKey?: string) {
    this.endpoint = endpoint.replace(/\/+$/, ""); // strip trailing slashes
    this.apiKey = apiKey;
    this.log.info({ endpoint: this.endpoint }, "ModelClient initialised");
  }

  /**
   * Send a chat completion request to the Nosana model endpoint.
   *
   * Implements retry logic with delays of 500 ms → 1500 ms → 3000 ms.
   * Each individual request is capped at 30 seconds before throwing
   * {@link ModelTimeoutError}.
   *
   * @param messages - Array of chat messages forming the conversation.
   * @param options  - Generation parameters (temperature, max_tokens, etc.).
   * @returns The model's response text.
   */
  async complete(
    messages: ChatMessage[],
    options: CompletionOptions = {},
  ): Promise<string> {
    const url = `${this.endpoint}/chat/completions`;

    const body = JSON.stringify({
      model: process.env.MODEL_NAME ?? "qwen3.5-27b-awq-4bit",
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2048,
      top_p: options.top_p ?? 0.95,
      stop: options.stop,
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // ── Retry loop: 3 attempts with escalating delays ──
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      try {
        this.log.debug(
          { attempt: attempt + 1, url },
          "Sending completion request",
        );

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS,
        );

        const response = await fetch(url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "unknown");
          throw new Error(
            `Model API returned ${response.status}: ${errorBody}`,
          );
        }

        const data = (await response.json()) as {
          choices: { message: { content: string } }[];
        };

        const content = data.choices?.[0]?.message?.content ?? "";
        this.log.debug(
          { attempt: attempt + 1, responseLength: content.length },
          "Completion received",
        );

        return content;
      } catch (error: unknown) {
        // Convert AbortError (from timeout) into ModelTimeoutError
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          throw new ModelTimeoutError(
            `Model request timed out after ${REQUEST_TIMEOUT_MS}ms`,
          );
        }

        this.log.warn(
          { attempt: attempt + 1, error: String(error) },
          "Completion attempt failed",
        );

        // If we have retries left, wait before the next attempt
        if (attempt < RETRY_DELAYS.length - 1) {
          await this.sleep(RETRY_DELAYS[attempt]);
        } else {
          throw error; // exhausted all retries
        }
      }
    }

    // Unreachable — TypeScript guard
    throw new Error("Exhausted all retry attempts");
  }

  /**
   * Analyse the sentiment of a text string using the model.
   *
   * Uses a tightly constrained system prompt (temperature 0.2, max 50 tokens)
   * to extract a structured {@link SentimentResult}. Falls back to a neutral
   * score of 0.0 and confidence 0.5 if JSON parsing fails.
   *
   * @param text - The raw text (typically a tweet) to analyse.
   * @returns Structured sentiment result with score, label, and confidence.
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    const systemPrompt =
      'You are a sentiment analyzer. Return ONLY valid JSON: ' +
      '{"score": number (-1 to 1), "label": "positive"|"neutral"|"negative", ' +
      '"confidence": number (0 to 1)}. No explanation. No markdown.';

    try {
      const raw = await this.complete(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        { temperature: 0.2, max_tokens: 50 },
      );

      // Strip any markdown fences the model may sneak in
      const cleaned = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned) as SentimentResult;

      return {
        score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
        label: (["positive", "neutral", "negative"] as const).includes(
          parsed.label as "positive" | "neutral" | "negative",
        )
          ? (parsed.label as "positive" | "neutral" | "negative")
          : "neutral",
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
      };
    } catch (error) {
      this.log.warn(
        { error: String(error) },
        "Sentiment analysis failed — returning neutral fallback",
      );

      return { score: 0, label: "neutral", confidence: 0.5 };
    }
  }

  /** Simple async delay helper. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
