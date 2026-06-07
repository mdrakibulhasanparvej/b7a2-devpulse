# Serverless Function Crash Investigation Report

## Error
- **Error**: 500 INTERNAL_SERVER_ERROR — `FUNCTION_INVOCATION_FAILED`
- **Error ID**: `bom1::f6wsf-1780812575445-4a9a5fd75d74`
- **Platform**: Vercel Serverless Function (`@vercel/node`)

---

## Root Cause Analysis

### Primary Cause: No serverless-compatible export — `main()` called as top-level side effect (Critical)

The entry point `src/server.ts` (bundled into `dist/server.js`) does not export a handler. Instead, it calls `main()` immediately as a top-level side effect:

```typescript
// src/server.ts — line 5-12
const main = () => {
  initDB();                                    // async, un-awaited
  app.listen(config.port, () => {
    console.log(`Example app listening on port ${config.port}`);
  });
};
main();
```

The bundled output `dist/server.js:492` executes `main();` at module load time. This is a **long-running server pattern** (HTTP server with `listen()`), not a serverless function pattern.

How Vercel's `@vercel/node` runtime handles this:

1. It imports `dist/server.js`
2. The import triggers `main()` as a side effect
3. `main()` calls `initDB()` (async, un-awaited) and `app.listen(port, ...)`
4. Since there is **no default export** (Express app or `(req, res) => void` handler), `@vercel/node` falls back to a **bridge/launcher** mechanism
5. The bridge starts the Express HTTP server internally and proxies every Lambda invocation to it
6. This proxy hop is unreliable — the bridge may fail before the internal server is ready, especially if:
   - `config.port` is `undefined` (PORT env var not set on Vercel), causing `listen()` to throw `ERR_INVALID_ARG_VALUE`
   - `initDB()` hangs waiting for a database connection that will never come
   - The bridge times out waiting for the internal server to signal readiness

**Evidence**: `dist/server.js:492` — `main();` is a bare top-level call. No `export default app` or `export const handler` anywhere in the bundle.

---

### Secondary Cause: Database initialization on every cold start (High)

`initDB()` is called synchronously (un-awaited) inside `main()`:

```typescript
// src/db/index.ts — line 11-41
export const initDB = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS users ...`);
  await pool.query(`CREATE TABLE IF NOT EXISTS issues ...`);
};
```

Problems:
- The `Pool` is created at module scope (`src/db/index.ts:4`) with `connectionString: config.connection_string`. If `CONNECTIONSTRING` is not set in the Vercel project environment variables, `config.connection_string` is `undefined` and the pool is misconfigured.
- `pool.query()` will reject with a connection error, which is caught and logged but **not re-thrown** — the function continues to `app.listen()`.
- This unhandled rejection (`await` without proper error propagation from `main()`) generates an `unhandledRejection` at the Node.js process level, which can crash the serverless function before `listen()` completes.

---

### Contributing Factor: Missing runtime environment variables (Medium)

`src/config/index.ts` reads from `process.env`:

```typescript
const config = {
  connection_string: process.env.CONNECTIONSTRING as string,  // undefined on Vercel
  port: process.env.PORT,                                      // undefined on Vercel
  secret: process.env.JWT_SECRET,                              // undefined on Vercel
};
```

The local `.env` file is **not** automatically deployed to Vercel. The `dotenv.config()` call in the config module will fail silently because `.env` does not exist in Vercel's filesystem at runtime (only `.env.local` in the build container, and dotenv is not loaded for serverless runtime).

Missing env vars cause:
- `CONNECTIONSTRING` → `undefined` → `new Pool({ connectionString: undefined })` → queries fail with connection error
- `PORT` → `undefined` → `app.listen(undefined)` → Node.js throws `RangeError [ERR_INVALID_ARG_VALUE]: port must be >= 0 and < 65536` (or binds to random port depending on Node.js version)
- `JWT_SECRET` → `undefined` → `jwt.verify(token, undefined)` throws

---

### Contributing Factor: Express 5 on @vercel/node bridge (Low-Medium)

The project uses **Express 5** (`"express": "^5.2.1"`). Express 5 introduced breaking changes to error handling and middleware behavior. The `@vercel/node` bridge was primarily designed and tested with Express 4. The bridge's internal proxy may not correctly forward errors or handle Express 5's modified `req`/`res` properties, leading to invocation failures.

---

## Summary of Failure Sequence

```
1. Request hits Vercel → cold start
2. @vercel/node imports dist/server.js
3. Top-level main() executes:
   a. initDB() is called (unawaited promise)
   b. pool.query() fails (no CONNECTIONSTRING) → unhandledRejection
   c. app.listen(undefined) → ERR_INVALID_ARG_VALUE or hangs
4. @vercel/node bridge cannot connect to internal server → time out
5. FUNCTION_INVOCATION_FAILED
```

## Required Fixes

1. **Create a Vercel-compatible entry point** that exports the Express `app` without calling `listen()`:
   - e.g., `api/index.ts` that does `export default app`
   - Update `vercel.json` to point to the new entry
   - Move the `listen()` call behind a runtime guard (`if (process.env.VERCEL !== "1")`)

2. **Configure Vercel environment variables**:
   - `CONNECTIONSTRING` (Neon PostgreSQL connection string)
   - `JWT_SECRET` (JWT signing secret)
   - (Optional) `PORT` is usually unnecessary on Vercel

3. **Handle `Bearer ` prefix** in auth middleware (documented separately in `authorization.md`)

## Files Examined

| File | Relevance |
|---|---|
| `src/server.ts` | Calls `main()` top-level, no export — **primary cause** |
| `src/app.ts` | Correctly exports `app`, but this export is never used by Vercel |
| `dist/server.js` | Bundled output — confirms `main()` at top level, no export |
| `src/db/index.ts` | `initDB()` runs at startup, fails silently if DB unreachable |
| `src/config/index.ts` | Reads env vars without fallbacks |
| `vercel.json` | Routes all traffic to `dist/server.js` via `@vercel/node` |
| `tsup.config.ts` | Bundles `src/server.ts` — entry point has no export |
| `.env` | Local-only; not deployed to Vercel |
