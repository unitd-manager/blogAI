import { ChatOpenAI } from '@langchain/openai';

export function getAiMode() {
  return process.env.AI_MODE || (process.env.OPENAI_API_KEY ? 'openai' : 'free');
}

export function isAiEnabled() {
  const mode = getAiMode();
  return mode === 'ollama' || (mode === 'openai' && Boolean(process.env.OPENAI_API_KEY));
}

export function createChatModel({ temperature = 0.4, timeout } = {}) {
  const mode = getAiMode();
  if (mode === 'free') throw new Error('Free mode does not use an AI model.');
  if (mode === 'ollama') {
    const baseURL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
    return new ChatOpenAI({
      model: process.env.OLLAMA_MODEL || 'llama3.2:1b-instruct-q2_K',
      apiKey: 'ollama-local',
      configuration: { baseURL },
      temperature,
      maxTokens: Number(process.env.OLLAMA_MAX_TOKENS || 1200),
      maxRetries: 0,
      timeout: timeout || 180_000
    });
  }
  if (mode === 'openai' && process.env.OPENAI_API_KEY) {
    const customBase = process.env.OPENAI_BASE_URL;
    const config = {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      openAIApiKey: process.env.OPENAI_API_KEY,
      temperature,
      maxRetries: 1,
      timeout: timeout || 60_000
    };
    // Reasoning models (e.g. openai/gpt-oss-* on Groq) can spend the whole output budget on hidden
    // reasoning and return an empty reply. Keep reasoning short and leave room for the answer.
    if (/gpt-oss|o\d|reason/i.test(config.model)) {
      config.maxTokens = Number(process.env.OPENAI_MAX_TOKENS || 8192);
      config.modelKwargs = { reasoning_effort: process.env.OPENAI_REASONING_EFFORT || 'low' };
    }
    if (customBase) {
      config.configuration = {
        baseURL: customBase.replace(/\/$/, ''),
        defaultHeaders: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` }
      };
    }
    return withRateLimitRetry(new ChatOpenAI(config));
  }
  throw new Error(`Unsupported AI mode: ${mode}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Free-tier providers (e.g. Groq: 8k tokens/minute) reject bursts with HTTP 429 and say
// "try again in Xs". Wait that long and retry (within a time budget) instead of failing.
// Applied here so every caller — website analysis and article writing — gets it.
function withRateLimitRetry(model, budgetMs = 150_000) {
  const invoke = model.invoke.bind(model);
  model.invoke = async (...args) => {
    const deadline = Date.now() + budgetMs;
    for (;;) {
      try {
        return await invoke(...args);
      } catch (error) {
        const message = String(error?.message || '');
        const isRateLimit = error?.status === 429 || /\b429\b|rate limit/i.test(message);
        const hinted = Number(message.match(/try again in ([\d.]+)s/i)?.[1]);
        const wait = Math.min(Number.isFinite(hinted) ? hinted * 1000 + 1000 : 15_000, 60_000);
        if (!isRateLimit || Date.now() + wait > deadline) throw error;
        console.warn(`[ai] Rate limited; retrying in ${Math.round(wait / 1000)}s`);
        await sleep(wait);
      }
    }
  };
  return model;
}
