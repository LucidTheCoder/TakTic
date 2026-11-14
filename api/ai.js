const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
// Zero-cost models only. Keep in sync with src/services/ai/models.ts.
const MODELS = [
  'particle-ai/particle-1:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
];
const MODEL = MODELS[0];
const MAX_TOKENS = 2000;
const MAX_BODY_BYTES = 1_000_000;
const TIMEOUT_MS = 55_000;

function send(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(payload === undefined ? undefined : JSON.stringify(payload));
}

function fail(res, status, code, message) {
  return send(res, status, { error: { code, message } });
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const hosts = [req.headers['x-forwarded-host'], req.headers.host]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim());

  return hosts.some(
    (host) => host === originUrl.host || host.split(':')[0] === originUrl.hostname,
  );
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    if (req.body.length > MAX_BODY_BYTES) throw new Error('too-large');
    return JSON.parse(req.body.toString('utf8'));
  }
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) throw new Error('too-large');
    return JSON.parse(req.body);
  }

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('too-large');
  }
  return raw.length > 0 ? JSON.parse(raw) : null;
}

function clamp(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return false;
  let characters = 0;
  for (const message of messages) {
    if (!message || typeof message !== 'object') return false;
    if (!['system', 'user', 'assistant'].includes(message.role)) return false;
    if (typeof message.content !== 'string') return false;
    characters += message.content.length;
    if (characters > 250_000) return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return fail(res, 405, 'method', 'Use POST for AI requests.');
  }

  if (!isSameOrigin(req)) {
    return fail(res, 403, 'origin', 'This endpoint only accepts requests from its own site.');
  }

  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    return fail(
      res,
      503,
      'deployment',
      'This deployment is missing its OpenRouter key. The site owner needs to add OPENROUTER_API_KEY in Vercel and redeploy.',
    );
  }

  let body;
  try {
    body = await readJson(req);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === 'too-large';
    return fail(
      res,
      tooLarge ? 413 : 400,
      tooLarge ? 'request-too-large' : 'invalid-json',
      tooLarge ? 'The AI request is too large.' : 'The AI request body was not valid JSON.',
    );
  }

  if (!body || typeof body !== 'object' || !validMessages(body.messages)) {
    return fail(res, 400, 'invalid-request', 'The AI request did not include valid messages.');
  }

  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0]?.trim();
  const referer = origin || (host ? `https://${host}` : 'https://taktic.vercel.app');

  const payload = {
    model: MODEL,
    models: MODELS.slice(1),
    messages: body.messages,
    temperature: clamp(body.temperature, 0, 1.5) ?? 0.35,
    max_tokens: Math.round(clamp(body.max_tokens, 1, MAX_TOKENS) ?? MAX_TOKENS),
    // Free routing can select reasoning models that consume the whole token
    // budget on hidden reasoning and return an empty message.
    reasoning: { effort: 'none', exclude: true },
    provider: { sort: 'throughput' },
  };

  if (body.response_format && body.response_format.type === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': referer,
        'X-Title': 'TakTic',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data = null;
    const raw = await response.text();
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return fail(
          res,
          503,
          'deployment',
          'The OpenRouter key configured for this deployment was rejected. The site owner needs to update OPENROUTER_API_KEY in Vercel.',
        );
      }

      const detail =
        data && typeof data.error?.message === 'string'
          ? data.error.message
          : `OpenRouter returned ${response.status}.`;
      return fail(res, response.status, 'upstream', detail);
    }

    if (!data || typeof data !== 'object') {
      return fail(res, 502, 'upstream', 'OpenRouter returned an unreadable response.');
    }

    return send(res, 200, data);
  } catch (error) {
    if (controller.signal.aborted) {
      return fail(res, 504, 'timeout', 'The AI request timed out. Try again.');
    }
    return fail(res, 502, 'network', 'Could not reach OpenRouter from this deployment.');
  } finally {
    clearTimeout(timeout);
  }
}
