# U12 备课助手上线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the spike planner online on Vercel. It gets an email-code login, a DeepSeek-backed generator, Supabase storage, and phone/tablet install. The coach's Artifact data is imported.

**Architecture:**
- The spike page stays one plain HTML file, `public/index.html`.
- A classic script, `public/runtime.js`, defines the same `window.claude` interface the page already uses: `use("sample" | "db" | "user")`. It is backed by Supabase (auth plus a `docs` table under RLS) and by one Vercel Function, `api/sample.ts`.
- `api/sample.ts` checks the login and a daily euro cap, then streams DeepSeek's answer back as NDJSON.

**Tech Stack:**
- Node 24 (built-in `node --test`, native TypeScript type stripping) and TypeScript `tsc --noEmit` for typecheck.
- `openai` npm SDK pointed at `https://api.deepseek.com`.
- `@supabase/supabase-js` 2.x: from npm on the server, and loaded in the browser by dynamic `import()` from jsDelivr.
- Vercel (Node runtime, region `fra1`) and GitHub Actions.

**Spec:** `docs/specs/2026-11-19-online-deployment-design.md`. The spike's design and lessons are in `docs/specs/2026-11-07-basketball-session-agent-design.md`.

## Global Constraints

- **Repo:** https://github.com/minglu-prime/Sports-agent. It is public, so never commit keys, `.env*`, or Artifact exports. The repo root is `D:\claude\Sport Agent`.
- **Git** (rules in `D:\claude\CLAUDE.md`):
  - Conventional Commits. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Work happens on a feature branch from `main`. The PR is merged with a merge commit, and the remote branch is deleted afterwards.
  - Only the baseline commit (Task 1) goes straight to the empty `main`.
- **Page logic:** don't change it. `public/index.html` = `spike/trainingsplaner.html` plus these three edits:
  - the runtime script tag;
  - PWA meta tags;
  - claude.ai login copy changed to `请先登录`.
- **Model:**
  - `DEEPSEEK_MODEL` defaults to `deepseek-flash`.
  - `DEEPSEEK_REASONING_EFFORT` defaults to `high` (Task 9 may lower it to `none`).
  - `response_format: {type:"json_object"}`, `stream: true`, `stream_options: {include_usage: true}`.
- **Prices** (USD per 1M tokens, peak rates, used for the cap): `deepseek-flash` input 0.30, output 1.20; `deepseek-v4-pro` input 1.32, output 3.96. Use `USD_TO_EUR = 0.92` (ponytail: fixed rate). The cap is `DAILY_EURO_CAP`, default `3`.
- **Error codes** the page knows: `rate_limited`, `invalid_json`, `prompt_too_large`, `upstream_error`, `cancelled`, `not_granted`.
- **Data:**
  - Supabase in the EU (Frankfurt). The table `docs(owner uuid, coll text, id text, data jsonb, created_at timestamptz, updated_at timestamptz)` has primary key `(owner, coll, id)` and RLS `owner = auth.uid()`.
  - The table `usage(owner uuid, day date, input_tokens bigint, output_tokens bigint, calls int)` has primary key `(owner, day)`, RLS on and no policies, so only the service role can use it.
- **Sign-in:** `signInWithOtp({ email, options: { shouldCreateUser: false } })`, then `verifyOtp({ email, token, type: "email" })`. No magic links.
- **Vercel:** `vercel.json` has `"regions": ["fra1"]` and sets `maxDuration` to `300` for `api/sample.ts`.
- **Global CLAUDE.md:**
  - no empty catch blocks;
  - every UI path covers loading, empty and error states;
  - `npm test && npm run typecheck` must pass before anything is called done;
  - a bug fix starts with a failing test.
- **Lint:** `npm run lint` = `tsc --noEmit` plus `node --check` on `public/*.js`. The project has no ESLint (ponytail: add it when a second contributor joins).

## Review Focus

1. **DeepSeek JSON mode returns blank content** (spaces only, `finish_reason: "stop"`). The page must get `invalid_json`, never an empty plan. Test in Task 3.
2. **The upstream stream dies midway**, or the client aborts. `upstream_error` or `cancelled` must reach the page, and the usage row must still record the tokens used. Test in Tasks 3 and 4.
3. **An expired or missing login on the home-screen app.** `use()` must show the sign-in overlay again instead of failing silently. A 401 from `/api/sample` must map to `not_granted`, and that must trigger re-login. Test in Task 5.
4. **`update()` on a doc that doesn't exist** must throw `{code: "not_found"}`, as on the Artifact. `toggleHeld` and `loadDetail` rely on it. Test in Task 5.
5. **Importing twice** must not duplicate rows, and must keep the Artifact ids. Test in Task 8.

---

### Task 1: Baseline repo with the spike and green checks

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `README.md`
- Move: `spike/trainingsplaner.html` → `public/index.html`; `spike/checks/*` → `tests/spike/*`; `spike/harness/*` → `tests/harness/*`; `spike/prompt-eval/*` → `tests/prompt-eval/*`; `spike/README.md` is replaced by the new `README.md`.
- Modify: `tests/spike/all.js` (page path `../../public/index.html`), `tests/harness/build.js` (page path).

**Interfaces:**
- Produces:
  - npm scripts: `test` (`node --test tests/` then `node tests/spike/all.js`), `typecheck` (`tsc --noEmit`), `lint` (`npm run typecheck && node --check public/runtime.js`, added once that file exists).
  - `.gitignore` entries: `node_modules/`, `.env*`, `.vercel/`, `tests/harness/page.html`, `exports/`.

- [ ] **Step 1:** Run `git init -b main`. Move the files. Fix the two page paths.
- [ ] **Step 2:** Run `node tests/spike/all.js`. Expected: `all passed`.
- [ ] **Step 3:** Run `npm install -D typescript @types/node`. `tsconfig.json`: `strict`, `module` `nodenext`, `noEmit`, `allowImportingTsExtensions`, `include ["api","lib","tests","scripts"]`.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: pass. With no TS files yet, typecheck may need `"files": []` for now.
- [ ] **Step 5:** Commit `chore: baseline spike planner and checks` on `main`. Add remote `https://github.com/minglu-prime/Sports-agent.git`. Push `main`. Create the branch `feat/online-deploy`.

### Task 2: Cost and cap

**Files:**
- Create: `lib/cost.ts`
- Test: `tests/cost.test.ts`

**Interfaces:**
- Produces:
  - `euros(model: string, inputTokens: number, outputTokens: number): number`
  - `overCap(spentEuro: number, capEuro: number): boolean`
  - `PRICES: Record<string, { in: number; out: number }>` (USD per 1M tokens, peak)

- [ ] **Step 1:** Write the failing tests:
  - `euros("deepseek-flash", 1_000_000, 1_000_000)` = `(0.30 + 1.20) * 0.92` = `1.38`, within 1e-9;
  - an unknown model throws `Error("unknown model")`;
  - `overCap(3, 3) === true`;
  - `overCap(2.99, 3) === false`.
- [ ] **Step 2:** Run `node --test tests/cost.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement using the constants in Global Constraints.
- [ ] **Step 4:** Run `node --test tests/cost.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): DeepSeek cost and daily cap`.

### Task 3: DeepSeek stream → page events

**Files:**
- Create: `lib/deepseek.ts`
- Test: `tests/deepseek.test.ts`

**Interfaces:**
- Consumes: the `openai` SDK (`npm install openai`).
- Produces:
  - `type PageEvent = { type: "progress"; delta: string } | { type: "result"; data: unknown } | { type: "error"; code: string; message: string }`
  - `async function* askJson(client: OpenAI, opts: { model: string; effort: string; prompt: string; signal: AbortSignal }): AsyncGenerator<PageEvent, { inputTokens: number; outputTokens: number }>`
  - `mapError(e: unknown): { code: string; message: string }`

Approach:
- Send the page's prompt as one `user` message.
- Pass `thinking` / `reasoning_effort` per the DeepSeek docs: `reasoning_effort` is a top-level param, and `thinking: {type: effort === "none" ? "disabled" : "enabled"}`.
- Yield `progress` for every non-empty `delta.reasoning_content` or `delta.content`.
- Accumulate only `delta.content`. At the end, `JSON.parse` it. If the content is blank (only whitespace) or doesn't parse, yield `error invalid_json`.
- The usage comes from the final chunk.

- [ ] **Step 1:** Write the failing tests. Use a fake client whose `chat.completions.create` returns an async iterable of chunks.
  - (a) A reasoning chunk, then content chunks `{"a":`, `1}`, then a usage chunk. Expect the events `progress ×3`, then `result {a:1}`. The return value is `{inputTokens, outputTokens}` from the usage.
  - (b) Content `"   "` with `finish_reason` `"stop"`. Expect the last event to be `error invalid_json`.
  - (c) The iterator throws an `APIError` with status 402. `mapError` gives `{code: "upstream_error", message: "DeepSeek 余额不足"}`.
  - (d) Status 429 or 503 gives `rate_limited`. 400 or 422 give `upstream_error` with DeepSeek's message. 413 gives `prompt_too_large`.
  - (e) The signal is aborted mid-stream. Expect `error cancelled`, and the tokens counted so far are returned.
- [ ] **Step 2:** Run `node --test tests/deepseek.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test tests/deepseek.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): stream DeepSeek JSON answers as page events`.

### Task 4: `/api/sample` and `/api/config`

**Files:**
- Create: `api/sample.ts`, `api/config.ts`, `lib/auth.ts`, `lib/usage.ts`, `vercel.json`
- Test: `tests/sample.test.ts`

**Interfaces:**
- Consumes: `askJson`, `mapError` (Task 3); `euros`, `overCap` (Task 2).
- Produces:
  - `POST /api/sample`
    - Headers: `Authorization: Bearer <supabase access token>`. Body: `{ prompt: string }`.
    - Response: `200` `application/x-ndjson`, one `PageEvent` per line.
    - Errors: `401` → `{code:"not_granted"}` JSON; `400` → `{code:"upstream_error"}` for a missing or too long prompt (over 200 000 chars → `prompt_too_large`).
  - `GET /api/config` → `{ supabaseUrl, supabaseAnonKey }`.
  - `lib/auth.ts`: `userIdFromToken(token: string, supa: SupabaseClient): Promise<string | null>`
  - `lib/usage.ts`: `spentToday(owner, svc): Promise<number>` and `addUsage(owner, model, inTok, outTok, svc): Promise<void>`. Both use the `usage` table with the service-role client, and the day is UTC.
- Handlers are `export async function POST(req: Request): Promise<Response>` (and `GET`). They take dependencies through a `deps` factory, which tests override.

- [ ] **Step 1:** Write the failing tests. Stub supabase and the DeepSeek client through `deps`.
  - No token → 401 `not_granted`.
  - Spent today ≥ cap → a single NDJSON line `error rate_limited` "今天的用量到上限了，明天再试", and DeepSeek is never called.
  - A normal answer streams the `progress` and `result` lines, and `addUsage` is called once with the returned tokens.
  - An upstream error midway: the `error` line is the last line, and `addUsage` is still called.
  - A request abort aborts the upstream signal.
- [ ] **Step 2:** Run `node --test tests/sample.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Env vars: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_REASONING_EFFORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DAILY_EURO_CAP`. A missing required env var gives `500 {code:"upstream_error", message:"服务器没配置 <NAME>"}`. `vercel.json`: `{"regions":["fra1"],"functions":{"api/sample.ts":{"maxDuration":300}}}`.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(api): authenticated, capped DeepSeek endpoint`.

### Task 5: `public/runtime.js`, the `window.claude` adapter with sign-in

**Files:**
- Create: `public/runtime.js`, `supabase/migrations/001_docs_usage.sql`
- Modify: `public/index.html`:
  - add `<script src="runtime.js"></script>` before the page's `<script>`;
  - change the 3 strings mentioning `claude.ai` to `请先登录`.
- Test: `tests/runtime.test.ts`. It loads `runtime.js` in `node:vm` with a fake `globalThis`.

**Interfaces:**
- Produces:
  - `window.claude.use(name)` → `Promise<sample | db | user>` with the Artifact's semantics (see `tests/harness/mock.js`).
  - `globalThis.U12Runtime = { makeDb(client, uid), makeSample(fetchFn, getToken), collPath(path, uid) }`, for tests.
- Rules:
  - **Collection paths:** `collPath("data/users/<uid>", uid) === ""` and `collPath("data/users/<uid>/t_1/msgs", uid) === "t_1/msgs"`. Any other prefix throws.
  - **Query mapping:**
    - `where("kind","==",v)` → `.eq("data->>kind", v)`;
    - `orderBy(k, dir)` → `.order("data->>"+k, {ascending: dir !== "desc"})`;
    - `limit(n)` → `.limit(n)`.
  - **Writes:** `add` makes a 20-character random `[a-z0-9]` id and inserts it. `set` upserts. `update` reads the row, shallow-merges, and writes; a missing row throws `{code:"not_found"}`. `delete` deletes.
  - **Values:** writes containing `undefined` throw `{code:"invalid_argument"}`. Every value read is deep-frozen.
  - **Sample:** `json(prompt, {signal, onText})` POSTs to `/api/sample`. It reads NDJSON, calls `onText({text: accumulatedDeltas})`, and resolves with `result.data`. It throws `{code, message}` on an `error` line. An abort throws `{code:"cancelled"}`. A 401 clears the session, shows sign-in, and throws `{code:"not_granted"}`.
  - **Sign-in overlay:** two steps (email, then the 6-digit code). Each step shows loading, error and "验证码已发送到 …" states. It includes the line "请不要输入孩子的全名". A `退出登录` button is appended into `#sheet .panel`.
  - **Loading supabase-js:** `import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm")`. A load failure shows an error in the overlay; it never fails silently.

- [ ] **Step 1:** Write the failing tests with a fake supabase query builder that records calls:
  - the `collPath` cases;
  - `where`/`orderBy`/`limit` produce the mapped calls;
  - `update` on a missing doc rejects `not_found`;
  - `set` with an `undefined` field rejects `invalid_argument`;
  - read values are frozen (`Object.isFrozen(data.plan)`);
  - `makeSample` with a fake fetch streaming 2 progress lines and a result calls `onText` twice, the second time with the concatenated text, and resolves with the data;
  - an `error` line rejects with its code;
  - a 401 rejects `not_granted`.
- [ ] **Step 2:** Run `node --test tests/runtime.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `runtime.js` and the SQL (tables, primary keys, RLS policy `owner = auth.uid()` for select/insert/update/delete on `docs`, index on `(owner, coll)`). Edit `index.html`.
- [ ] **Step 4:** Run `npm test && npm run lint`. Expected: PASS. Then run `node tests/harness/build.js` and run `flow.js` and `races.js` in the browser. Expected: every value `true` (the harness keeps `mock.js`, so the page is unchanged).
- [ ] **Step 5:** Commit `feat(web): runtime adapter with Supabase login`.

### Task 6: Install on phone and tablet (PWA)

**Files:**
- Create: `public/manifest.webmanifest`, `scripts/make-icons.mjs`, `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180 px)
- Modify: the `<head>` of `public/index.html`: `manifest`, `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` `U12备课`, `apple-touch-icon`.
- Test: `tests/pwa.test.ts`.

**Interfaces:**
- The manifest has `name: "U12 备课助手"`, `short_name: "U12备课"`, `display: "standalone"`, `start_url: "/"`, `background_color` and `theme_color` `#EDEDED`, and icons at 192 and 512.

- [ ] **Step 1:** Write the failing test:
  - the manifest parses and its icon files exist;
  - the PNG headers say 192×192 and 512×512;
  - `index.html` links the manifest and `apple-touch-icon`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** `make-icons.mjs` draws an orange ball with black seams (shapes only, no text) into a raw RGBA buffer. It encodes PNGs with `node:zlib` (filter 0 per row, CRC from a table). No dependency.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(web): installable on phone and tablet`.

### Task 7: CI and README

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1:** `ci.yml`: on push and pull_request, Node 24, `npm ci && npm test && npm run lint`.
- [ ] **Step 2:** The README covers only what the app does, how to run it locally (`npx vercel dev`), how to run the checks, the env var list, how to invite a person (Supabase → Authentication → Users → Invite), and the privacy line (DeepSeek processes prompts in China; no children's full names).
- [ ] **Step 3:** Push the branch. Expected: the CI run is green (`gh run watch`).
- [ ] **Step 4:** Commit `ci: run checks on every push` and `docs: README for the online version`.

### Task 8: Artifact import script

**Files:**
- Create: `scripts/import-artifact.mjs`
- Test: `tests/import.test.ts`

**Interfaces:**
- CLI: `node scripts/import-artifact.mjs <exportDir> <ownerUuid>`. It reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `exportDir` is in the `ArtifactData out_dir` layout: `data/users/me/<id>.json` for root docs and `data/users/me/<tid>/msgs/<id>.json` for messages. Each file's document fields are under `data` when present, otherwise the file itself.
- Exports `rowsFromExport(dir: string, owner: string): { coll: string; id: string; data: object }[]` for tests.
- Upserts on `(owner, coll, id)` and prints the counts per kind.

- [ ] **Step 1:** Write the failing test. Build a temp dir with one thread doc, one message, one `h_` doc and one `lib_` doc.
  - `rowsFromExport` returns 4 rows with the right `coll` (`""` or `t_x/msgs`) and the original ids.
  - Running it twice gives the same rows (idempotent by key).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(scripts): import Artifact history into Supabase`.

### Task 9: Go live (with the coach)

These steps need the coach's accounts. I write each click path into the chat; the coach does the clicking and pastes all keys.

- [ ] **Step 1, Supabase** (coach):
  - New project, region Frankfurt.
  - SQL Editor: run `supabase/migrations/001_docs_usage.sql`.
  - Authentication → Providers → Email: allow sign-ups **off**.
  - Email Templates "Magic Link" and "Invite user": body contains `{{ .Token }}` (I supply the text).
  - Invite the coach's email.
  - Copy the URL, the anon key and the service role key into Vercel (Step 2), never into chat.
- [ ] **Step 2, Vercel** (coach): New Project → import `minglu-prime/Sports-agent`. Add the env vars from Task 4 (`DEEPSEEK_REASONING_EFFORT=high`). Deploy.
- [ ] **Step 3, live checks** (me, on the preview URL with the coach signed in, through the browser):
  - One real plan request. Confirm that JSON mode with thinking works. If DeepSeek returns 400 for that combination, set `DEEPSEEK_REASONING_EFFORT=none`. That's an env change, not code.
  - Rerun the prompt eval: the four prompts in `tests/prompt-eval/*.txt` sent through `/api/sample` from the page, scored with `tests/spike/eval-answers.js`. Pass bar: both plans valid, pictures lay out with no problems.
  - RLS: a second invited test user can't read the coach's rows. Remove that user afterwards.
- [ ] **Step 4, import** (me): export the Artifact data with `ArtifactData` (`out_dir` = `D:\claude\Sport Agent\exports`, which is git-ignored). Run `import-artifact.mjs` with the coach's new user id. The thread, message, held and library counts match the export.
- [ ] **Step 5, smoke test on devices** (the coach, guided):
  - iPhone: Safari → share → 添加到主屏幕 → sign in with the code.
  - Then make a plan, pictures appear, 标记已上课, 👍, ▶ 上课.
  - The same on the iPad in landscape: the sidebar stays open.
- [ ] **Step 6:** Open the PR `feat: 备课助手上线（Vercel + Supabase + DeepSeek）`. CI is green. Merge with a merge commit, then delete the branch. Production URL in the README.
