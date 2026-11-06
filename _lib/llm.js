// OpenAI Responses API with the built-in web_search tool (same settings as historica-grant-bot/config.py).
const MODEL = () => process.env.OPENAI_MODEL || 'gpt-5-nano';
const MAX_OUTPUT_TOKENS = 6000;   // reasoning tokens count against this, so keep effort low
const MAX_TOOL_CALLS = 5;
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || 'low';

let override = null;
export function setLlm(fn) { override = fn; } // tests / local preview

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** size: "low" for checking one known page, "medium" for open-ended discovery (the main token-cost lever). */
export async function callLlm(prompt, size = 'low') {
  if (override) return override(prompt, size);
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  for (let attempt = 0; ; attempt++) {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: MODEL(),
        input: prompt,
        tools: [{ type: 'web_search', search_context_size: size }],
        max_output_tokens: MAX_OUTPUT_TOKENS,
        max_tool_calls: MAX_TOOL_CALLS,
        reasoning: { effort: REASONING_EFFORT },
      }),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 4) { await sleep(2000 * 2 ** attempt); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j.error?.message || r.statusText}`);
    const text = (j.output || [])
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content || [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text)
      .join('\n')
      .trim();
    if (j.status && j.status !== 'completed' && !text) {
      throw new Error(`OpenAI response ${j.status}: ${j.incomplete_details?.reason || 'no output'}`);
    }
    return text;
  }
}

/** Forgiving parser: strips markdown fences and isolates the JSON array. */
export function extractJsonArray(text) {
  const t = String(text || '').trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  if (a === -1 || b === -1 || b < a) return [];
  try {
    const v = JSON.parse(t.slice(a, b + 1));
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}
