/**
 * Zero-cost models only. The first model is the default; the rest are
 * fallbacks for rate limits or temporary provider failures.
 *
 * Keep this list in sync with MODELS in api/ai.js.
 */
export const DEFAULT_AI_MODEL = 'particle-ai/particle-1:free';

export const FREE_AI_MODELS = [
  DEFAULT_AI_MODEL,
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
] as const;
