import type { ZodType } from 'zod';

export type AiErrorCode =
  | 'missing-key'
  | 'deployment'
  | 'timeout'
  | 'network'
  | 'auth'
  | 'credits'
  | 'rate-limit'
  | 'server'
  | 'invalid-response'
  | 'aborted'
  | 'unknown';

export class AiError extends Error {
  code: AiErrorCode;

  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

export interface AiConfig {
  apiKey: string;
  model: string;
}

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const PROXY_ENDPOINT = '/api/ai';
const REQUEST_TIMEOUT_MS = 55_000;

/**
 * Production builds use the Vercel function at /api/ai, which holds the
 * deployment's key server-side. Local development uses a key entered in Settings.
 */
export function managedAiEnabled(): boolean {
  return import.meta.env.PROD;
}

export function isAiConfigured(config: AiConfig): boolean {
  return managedAiEnabled() || config.apiKey.trim().length > 0;
}

export function describeAiError(error: unknown): string {
  if (error instanceof AiError) {
    switch (error.code) {
      case 'missing-key':
        return 'Add your OpenRouter API key in Settings to use the AI features.';
      case 'deployment':
        return (
          error.message ||
          'This deployment’s AI connection is not configured. The site owner needs to add an OpenRouter key.'
        );
      case 'timeout':
        return 'The AI request took too long. Your work is safe — try again.';
      case 'network':
        return 'Could not reach OpenRouter. Check your connection and try again.';
      case 'auth':
        return 'OpenRouter rejected this API key. Check it in Settings → AI.';
      case 'credits':
        return 'This OpenRouter account has no credits available.';
      case 'rate-limit':
        return 'OpenRouter is rate-limiting requests. Wait a moment and try again.';
      case 'server':
        return 'OpenRouter is having trouble right now. Try again shortly.';
      case 'invalid-response':
        return error.message || 'The AI returned a response in an unexpected format. Try again.';
      case 'aborted':
        return 'The request was cancelled.';
      default:
        return 'The AI request failed. Your existing data has not changed.';
    }
  }
  return 'The AI request failed. Your existing data has not changed.';
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf('{');
    const end = withoutFences.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(withoutFences.slice(start, end + 1));
      } catch {
        throw new AiError('invalid-response', 'The AI response was not valid JSON.');
      }
    }
    throw new AiError('invalid-response', 'The AI response did not contain JSON.');
  }
}

interface ChatRequest {
  config: AiConfig;
  system: string;
  user: string;
  schema: ZodType;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: number | string };
}

async function requestOnce(
  body: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal,
): Promise<OpenRouterResponse> {
  const managed = managedAiEnabled();
  const response = await fetch(managed ? PROXY_ENDPOINT : ENDPOINT, {
    method: 'POST',
    headers: managed
      ? { 'Content-Type': 'application/json' }
      : {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            typeof window !== 'undefined' ? window.location.origin : 'https://taktic.local',
          'X-Title': 'TakTic',
        },
    body: JSON.stringify(body),
    signal,
  });

  let data: OpenRouterResponse = {};
  try {
    data = (await response.json()) as OpenRouterResponse;
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data.error?.message ?? '';
    if (managed && data.error?.code === 'deployment') {
      throw new AiError('deployment', detail);
    }
    if (managed && data.error?.code === 'timeout') {
      throw new AiError('timeout', detail || 'The AI request timed out.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new AiError('auth', detail || 'The OpenRouter API key was rejected.');
    }
    if (response.status === 402) {
      throw new AiError('credits', detail || 'OpenRouter reported insufficient credits.');
    }
    if (response.status === 429) {
      throw new AiError('rate-limit', detail || 'OpenRouter rate limit reached.');
    }
    if (response.status >= 500) {
      throw new AiError('server', detail || 'OpenRouter server error.');
    }
    throw new AiError('unknown', detail || `OpenRouter returned ${response.status}.`);
  }

  return data;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function requestStructured<T>({
  config,
  system,
  user,
  schema,
  temperature = 0.35,
  maxTokens = 1600,
  signal,
}: ChatRequest): Promise<T> {
  if (!isAiConfigured(config)) {
    throw new AiError('missing-key', 'An OpenRouter API key is required.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  const body = {
    model: config.model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `${system}\n\nRespond with a single JSON object that matches the requested shape exactly. Do not wrap it in markdown.`,
      },
      { role: 'user', content: user },
    ],
  };

  let lastError: unknown = null;
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const data = await requestOnce(body, config.apiKey.trim(), controller.signal);
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new AiError('invalid-response', 'The AI returned an empty response.');
        }
        const parsed = extractJson(content);
        const validation = schema.safeParse(parsed);
        if (!validation.success) {
          const issue = validation.error.issues[0];
          throw new AiError(
            'invalid-response',
            `The AI response did not match the expected structure${
              issue ? ` (${issue.path.join('.') || 'root'}: ${issue.message})` : ''
            }.`,
          );
        }
        return validation.data as T;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof AiError &&
          (error.code === 'server' ||
            error.code === 'rate-limit' ||
            // Free routed models occasionally return malformed JSON; one retry is worthwhile.
            error.code === 'invalid-response');
        if (!retryable || attempt === 1) throw error;
        await wait(1100);
      }
    }
    throw lastError;
  } catch (error) {
    if (controller.signal.aborted) {
      if (signal?.aborted) throw new AiError('aborted', 'Request cancelled.');
      throw new AiError('timeout', 'The AI request timed out.');
    }
    if (error instanceof AiError) throw error;
    throw new AiError('network', 'The AI request could not be completed.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

export async function testOpenRouterConnection(config: AiConfig): Promise<string> {
  if (!isAiConfigured(config)) {
    throw new AiError('missing-key', 'An OpenRouter API key is required.');
  }
  const managed = managedAiEnabled();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(managed ? PROXY_ENDPOINT : ENDPOINT, {
      method: 'POST',
      headers: managed
        ? { 'Content-Type': 'application/json' }
        : {
            Authorization: `Bearer ${config.apiKey.trim()}`,
            'Content-Type': 'application/json',
            'HTTP-Referer':
              typeof window !== 'undefined' ? window.location.origin : 'https://taktic.local',
            'X-Title': 'TakTic',
          },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = '';
      let code = '';
      try {
        const data = (await response.json()) as OpenRouterResponse;
        detail = data.error?.message ?? '';
        code = String(data.error?.code ?? '');
      } catch {
        // The status code below is enough to explain the failure.
      }
      if (managed && code === 'deployment') {
        throw new AiError('deployment', detail);
      }
      if (managed && code === 'timeout') {
        throw new AiError('timeout', detail || 'The connection test timed out.');
      }
      if (response.status === 401 || response.status === 403) {
        throw new AiError('auth', detail || 'The API key was rejected.');
      }
      if (response.status === 402) {
        throw new AiError('credits', detail || 'No OpenRouter credits available.');
      }
      if (response.status === 429) {
        throw new AiError('rate-limit', detail || 'Rate limit reached.');
      }
      if (response.status === 404) {
        throw new AiError('unknown', 'That model is not available on OpenRouter.');
      }
      throw new AiError('server', detail || `OpenRouter returned ${response.status}.`);
    }
    return managed
      ? 'Connected through this deployment’s OpenRouter connection (openrouter/free).'
      : `Connected to ${config.model}.`;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AiError('timeout', 'The connection test timed out.');
    }
    if (error instanceof AiError) throw error;
    throw new AiError('network', 'Could not reach OpenRouter.');
  } finally {
    clearTimeout(timeout);
  }
}
