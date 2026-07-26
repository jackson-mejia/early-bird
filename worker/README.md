# Sync backend

A Cloudflare Worker over one KV namespace. It exists because the app needs a store that does not
expire — missed days are normal in a habit tracker, and the previous provider dropped a copy 24
hours after its last write.

## Deploying

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create SYNC
```

Paste the id it prints into `wrangler.toml`, then:

```bash
npx wrangler deploy
```

It prints a URL like `https://early-bird-sync.<your-subdomain>.workers.dev`. Put that in
`SYNC_BASE` at the top of the sync block in `../index.html`, commit, and push. Until `SYNC_BASE` is
set the app says sync is not configured rather than half-working.

Currently deployed at `https://early-bird-sync.cheezburgers.workers.dev`, against KV namespace
`68730625f42544b2b6a6f567f64da2e9`.

A freshly registered `workers.dev` subdomain resolves before its TLS certificate is issued, so the
first few minutes of requests fail the handshake rather than returning an error status. That is
expected and clears on its own.

## API

| Route | Method | Purpose |
|---|---|---|
| `/new` | POST | Store the posted JSON under a freshly minted code. Returns `{ "code": "..." }`. |
| `/b/:code` | GET | Return that code's JSON, or 404 if the code is unknown. |
| `/b/:code` | PUT | Overwrite an existing code's JSON. 404 if the code is unknown. |

`PUT` deliberately refuses to create. A mistyped code then fails loudly instead of quietly forking
into a second copy that nothing reads.

Codes are four segments — three words and four digits, drawn from `crypto.getRandomValues` — which
is around 2.6 billion combinations and is meant to be readable off one phone and typed into
another.

## What this does and does not protect

Anyone holding a code can read and change that copy. That is the accepted trade for having no
accounts and no passwords, and it is why the codes are random rather than guessable.

`ALLOWED_ORIGIN` pins CORS to the Pages origin, which stops other websites from calling this from
a browser. It does not stop a direct request from outside a browser, so `/new` is an open write
endpoint on your account. Bodies are capped at 256KB and must parse as JSON. At this size the free
tier's daily write limit is the practical ceiling; if it ever gets abused, add a shared token
check or Cloudflare rate limiting.

Entries are written with no expiry, so a copy stays put until it is overwritten.
