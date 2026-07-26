// Early Bird sync backend.
//
// One KV namespace, three routes, no accounts. Whoever holds a code can read
// and write that code's copy, which is the accepted trade for having no login.
// KV entries are written without an expiry, so a gap in logging costs nothing
// — that is the whole reason this exists rather than a public JSON bin.

const ALLOWED_ORIGIN = 'https://jackson-mejia.github.io';
const MAX_BYTES = 256 * 1024;

// Short and unambiguous, so a code can be read off one phone and typed into
// another without a "was that an l or a 1" moment.
const WORDS = [
  'amber', 'anchor', 'apple', 'arrow', 'aspen', 'basil', 'beacon', 'birch',
  'bloom', 'branch', 'bridge', 'cactus', 'candle', 'canyon', 'cedar', 'cherry',
  'cinder', 'clover', 'comet', 'copper', 'coral', 'cotton', 'crane', 'daisy',
  'dawn', 'delta', 'ember', 'fable', 'fern', 'forest', 'garnet', 'ginger',
  'harbor', 'hazel', 'heron', 'indigo', 'ivory', 'jasper', 'juniper', 'kettle',
  'lantern', 'laurel', 'lemon', 'lilac', 'linen', 'maple', 'marble', 'meadow',
  'nectar', 'nutmeg', 'olive', 'onyx', 'orchid', 'otter', 'pebble', 'pepper',
  'quartz', 'raven', 'saffron', 'sparrow', 'thistle', 'velvet', 'walnut', 'willow'
];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}

function makeCode() {
  const bytes = new Uint32Array(4);
  crypto.getRandomValues(bytes);
  const pick = i => WORDS[bytes[i] % WORDS.length];
  return pick(0) + '-' + pick(1) + '-' + pick(2) + '-' + String(1000 + (bytes[3] % 9000));
}

async function readBody(request) {
  const body = await request.text();
  if (body.length > MAX_BYTES) return { err: json({ error: 'payload too large' }, 413) };
  try { JSON.parse(body); } catch (e) { return { err: json({ error: 'body must be JSON' }, 400) }; }
  return { body };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, '');

    // Mint a new code and store the first copy under it.
    if (path === '/new' && request.method === 'POST') {
      const read = await readBody(request);
      if (read.err) return read.err;

      let code = makeCode();
      for (let i = 0; i < 5 && (await env.SYNC.get(code)) !== null; i++) code = makeCode();

      await env.SYNC.put(code, read.body);
      return json({ code }, 201);
    }

    const match = path.match(/^\/b\/([a-z0-9-]{1,64})$/);
    if (match) {
      const code = match[1];

      if (request.method === 'GET') {
        const value = await env.SYNC.get(code);
        if (value === null) return json({ error: 'unknown code' }, 404);
        return new Response(value, {
          status: 200,
          headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
        });
      }

      // Writing only to a code that already exists, so a mistyped code fails
      // loudly here instead of quietly forking into a second copy nobody reads.
      if (request.method === 'PUT') {
        const read = await readBody(request);
        if (read.err) return read.err;
        if ((await env.SYNC.get(code)) === null) return json({ error: 'unknown code' }, 404);
        await env.SYNC.put(code, read.body);
        return json({ ok: true }, 200);
      }
    }

    return json({ error: 'not found' }, 404);
  }
};
