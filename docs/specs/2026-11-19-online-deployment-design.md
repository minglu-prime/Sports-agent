# U12 备课助手上线（Vercel）：设计

Date: 2026-11-19. Status: approved by the coach on 2026-11-19, with DeepSeek as the model provider. Repo: https://github.com/minglu-prime/Sports-agent (public).
Builds on `2026-11-07-basketball-session-agent-design.md` and the spike in `spike/` (Artifact v21).

## Intent

The coach wants the planner as a normal website: open a link on phone, tablet or laptop and use it, without the claude.ai login wall, and later share it with assistant coaches. The code goes to the coach's GitHub repository and deploys on Vercel.

This reverses decision 2 of 2026-11-07 ("each coach uses their own claude.ai account; no PWA, central API key or Supabase until coaches without claude.ai accounts need access"). The coach asked for it on 2026-11-19. The new decision is: one central **DeepSeek** API key, paid by the coach (the coach chose DeepSeek over Claude on 2026-11-19).

## Goals

- Works on iPhone, iPad, Android and desktop browsers. "Add to Home Screen" gives an app-like icon and full screen.
- Same features as Artifact v21:
  - chat-based planning;
  - pictures;
  - the drill library;
  - practice mode;
  - the German option;
  - threads.
- The coach's existing chats, held sessions and library move over. Nothing is lost.
- Only invited people can sign in. Strangers cannot spend the API key.
- Cost stays visible and capped.

## Non-goals

- Public sign-up, payments, an app-store app.
- Generating plans offline. Reading old plans offline is also not a goal for v1.
- A shared team library. History stays private per coach, as decided on 2026-11-07.

## Anti-goals (failure even if it "works")

- An open endpoint that lets anyone burn the API key.
- Losing or duplicating the coach's history during migration.
- Regressions against the spike: every check in `spike/checks` and the harness flows must still pass.
- A sign-in that breaks on the iPhone home-screen app. Magic links open Safari, not the home-screen app, so the user stays logged out in the app.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (recommended)** | Keep the page as it is. Add a small `runtime.js` that implements the same `window.claude` interface the page already uses (`sample`, `db`, `user`) on top of Supabase plus one Vercel Function. | Least new code. All checks, the harness and the races repro keep working unchanged, because the page cannot tell the difference. The page stays one plain HTML file with no build step. |
| B | Rewrite as a Next.js / React app. | Conventional and easier to grow, but the 1200 lines of tested logic need porting, which risks regressions and takes weeks. Nothing visible improves for the coach. |
| C | Stay on the Artifact and put a home-screen shortcut on the phone. | Free and done today, but the login wall and the claude.ai-account requirement stay. That is exactly what the coach wants to remove. |

My pick is A. B is worth it only if the app grows far beyond the spike, and that can happen later on top of A's backend.

## Design (approach A)

### Pieces

```
repo/
  public/index.html          the spike page (from spike/trainingsplaner.html), plus <script src="runtime.js">
  public/runtime.js          window.claude adapter: sample / db / user on Supabase + /api/sample
  public/manifest.webmanifest, icons/   PWA: name, icons, standalone display, theme colour
  api/sample.ts              Vercel Function: checks the login, enforces limits, calls DeepSeek, streams progress
  supabase/migrations/       SQL: docs table, usage table, RLS
  scripts/import-artifact.mjs  one-off import of the Artifact data
  tests/                     spike checks + adapter tests + harness
  .github/workflows/ci.yml   runs the checks on every push
```

### Data (Supabase Postgres, EU region, Frankfurt)

- There is one table, `docs`, with these columns:
  - `owner uuid`
  - `coll text`
  - `id text`
  - `data jsonb`
  - `created_at`
  - `updated_at`
- The primary key is `(owner, coll, id)`.
- RLS allows rows only where `owner = auth.uid()`.
- `coll` is the Artifact path below `data/users/<id>`, so the existing layout maps 1:1:
  - `""` holds the threads, held records and library;
  - `"t_xxx/msgs"` holds a thread's messages.
- The adapter turns the page's calls into SQL:
  - `collection(path).where("kind","==",v)` becomes a filter on `data->>kind`;
  - `orderBy("ts")` sorts by `data->>ts`;
  - `limit`, `add`, `set`, `update`, `delete` and `get` map directly.
  - `update` on a missing doc fails, the same as the Artifact.
  - Values come back frozen, the same as the Artifact. That keeps the frozen-object lesson tested.
- A second table, `usage(owner, day, calls, input_tokens, output_tokens)`, is written only by the function, using the service role. It holds the daily cap and the cost numbers.

### Sign-in

- Supabase Auth with a **6-digit email code** (OTP), not a magic link. The code works inside the iPhone home-screen app.
- Public sign-up is off. The coach invites people by email from the Supabase dashboard. Later, a small `allowed_emails` table could let the coach invite people from the app.
- The session is kept by supabase-js in localStorage, so the coach stays signed in.

### Model calls (`api/sample.ts`, Node runtime, DeepSeek)

The function works in this order:

1. Verify the caller's Supabase JWT. Without a valid login it returns 401.
2. Check the daily cost cap per person (see "Settled after the builder check"). Over the cap it returns `rate_limited`, which the page already shows in Chinese.
3. Call DeepSeek's OpenAI-compatible Chat Completions API (`https://api.deepseek.com`, the `openai` npm package with `baseURL`, as DeepSeek's docs show). Settings:
   - `model: "deepseek-flash"`, set by the env var `DEEPSEEK_MODEL`;
   - `response_format: {type: "json_object"}`;
   - `stream: true` with `stream_options.include_usage`.
   - Thinking mode is DeepSeek's default (`reasoning_effort` defaults to `high`). The env var `DEEPSEEK_REASONING_EFFORT` (`none`/`low`/`high`) controls it.
   - The docs don't say whether JSON mode is allowed together with thinking. M1 checks this against the real API. If it is not allowed, the default becomes `none`.
4. Stream progress to the page as NDJSON. Counting `delta.reasoning_content` and `delta.content` characters drives the page's `onText` ("对方正在输入…（N字）"). The final parsed JSON comes last. An abort from the page aborts the upstream request.
5. Map failures to the error codes the page already knows:
   - DeepSeek 429 or 503, or the daily cap, give `rate_limited`;
   - 402 (DeepSeek balance used up) gives `upstream_error`, with the message "DeepSeek 余额不足";
   - 400 or 422 give `upstream_error`, with DeepSeek's message;
   - 413 or a context overflow give `prompt_too_large`;
   - blank or unparsable content gives `invalid_json`. DeepSeek's JSON mode can return only spaces;
   - an abort gives `cancelled`.
6. Record tokens in `usage`.

Prompts stay as they are in the page. They already ask for JSON and contain the word "json", which DeepSeek's JSON mode requires.

### Model and cost

These are DeepSeek list prices, checked on 2026-11-19 at https://api-docs.deepseek.com/quick_start/pricing/.

| Model | Price per 1M tokens (off-peak / peak) | One new session with 10 pictures |
|---|---|---|
| `deepseek-flash` (default) | input $0.15 / $0.30, output $0.60 / $1.20 | about €0.02–0.05 |
| `deepseek-v4-pro` | input $0.66 / $1.32, output $1.98 / $3.96 | about €0.10–0.20 |

DeepSeek's peak hours are 01:00–04:00 and 06:00–10:00 UTC on weekdays; every other hour is off-peak. German evening prep falls off-peak. At 2 sessions a week, the cost is well under €1 a month. The model is an environment variable.

### PWA, phone and tablet

- `manifest.webmanifest` with `display: standalone`, icons, `theme_color`, and `apple-touch-icon`.
- No service worker in v1. It isn't needed to install, and offline use is a non-goal.
- The spike layout already works for both sizes:
  - below 900 px, the sidebar slides in;
  - on a tablet in landscape, the sidebar stays open.
- These get checked on a real iPhone and iPad.

### Migration of the Artifact data

1. The coach signs in once on the new site, which creates the new user id.
2. I export the coach's Artifact data with the ArtifactData tool to JSON. This is a read, and the export goes to the project folder.
3. `scripts/import-artifact.mjs` writes the rows under the new user id. It is idempotent, so a second run adds nothing.
4. Check: thread, message, held and library counts match the export.

The Artifact stays online as a fallback.

### Deploy

- The GitHub repo connects to a Vercel project. Every push to `main` deploys to production. Every pull request gets a preview URL.
- Address: `<name>.vercel.app`. A custom domain can be added later in Vercel.
- Secrets live only in Vercel environment variables. The coach enters them, not me:
  - `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_REASONING_EFFORT`
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `DAILY_EURO_CAP`
- GitHub Actions runs the checks and a typecheck on every push. Merging requires a green run.

### Testing

- **Existing checks:** the spike checks (`checks/*.js`) run unchanged against `public/index.html`.
- **Adapter tests:**
  - run the page's real call patterns against a fake Supabase client, including frozen reads and `update`-missing-doc;
  - plus one test against a real Supabase test project: RLS blocks another user's rows.
- **Function tests:** no login gives 401, over the cap gives `rate_limited`, an abort cancels, and bad JSON gives `invalid_json`. DeepSeek is stubbed here.
- **Harness flows:** `flow.js` and `races.js` run in the browser against the local dev server.
- **Real-model check:** one prompt-eval run against the real API before go-live. That costs a few cents.
- **Smoke test on the deployed URL:** sign in, make a plan, draw pictures, mark it held, rate a drill, and open practice mode, on a phone and on a tablet.

## Milestones

| # | Result | Who |
|---|---|---|
| M0 | The GitHub repo, a Vercel project and a Supabase project (EU) exist and are connected. The secrets are set. | The coach creates the accounts and pastes the keys. I give exact click-by-click steps and do the code side. |
| M1 | `runtime.js`, `api/sample.ts` and the SQL are written and tested locally. All spike checks pass against the new layout. | me |
| M2 | Sign-in with the email code, invite-only access and the daily cap work on a preview URL. | me, then the coach tries it |
| M3 | PWA icons and manifest are in place. Phone and tablet checks done. | me, then the coach on real devices |
| M4 | The Artifact data is imported and the counts match. | me, after the coach's first sign-in |
| M5 | Production deploy. Smoke test on the coach's phone. README with the URL and how to invite someone. | me plus the coach |

## Settled after the builder check (2026-11-19)

**Answered by the project**
- **Data volume.** The Artifact holds one coach: 2 threads with a handful of messages, about 15 KB (read on 2026-11-14). The exact counts are re-read at M4, because v10–v21 may have added held records and library rows. `ArtifactData list` reads it in one page. Artifact doc ids (`t_xxx`, message ids, `h_…`, `lib_…`) are kept as `id`, so the import is idempotent by `(owner, coll, id)`. The largest row is about 13 KB of jsonb, far below any Supabase limit.
- **Test paths.** `spike/checks/all.js` and `harness/build.js` read the page by relative path. Moving the page to `public/index.html` changes only those path lines, not any test expectation.

**My calls**
- **Cap.** The cap is on cost, not on calls, because one session with pictures is about 11 calls.
  - `usage` stores tokens per person and day. The function turns them into euros using the model's list price.
  - Default `DAILY_EURO_CAP=3` per person. Over it, the function returns `rate_limited`.
  - Backstop: DeepSeek is prepaid. The coach tops up a small balance (for example $5), and when it runs out calls fail with "DeepSeek 余额不足".
- **Time limit.** `api/sample.ts` sets `maxDuration` to the plan's maximum (300 s with Fluid Compute). M0 verifies it on the coach's plan with one long plan call.
- **Sign-in UI.**
  - `runtime.js` loads before the page script and defines `window.claude` synchronously. `claude.use()` resolves only after sign-in.
  - Until then, `runtime.js` shows its own small sign-in overlay: email, then the 6-digit code. It adds a 退出登录 entry under the settings pill.
  - The page itself gets one changed line, the script tag.
- **Email.**
  - Login uses `signInWithOtp({ shouldCreateUser: false })`.
  - The Supabase email templates ("Magic Link" and "Invite user") are edited to show `{{ .Token }}`. M2 gives the coach the exact text to paste.
  - Supabase's built-in mail sender (a few emails per hour) is enough for one to five people. Custom SMTP comes only if it isn't.
- **Bad JSON.** No automatic retry, so no doubled cost. The error shows, and the coach sends again, the same as on the Artifact.
- **Model check.** Before go-live, rerun `spike/prompt-eval` with the chosen model. Pass bar: both plans pass the validator, and all pictures lay out with no problems.
- **Region and privacy.**
  - The Vercel function runs in `fra1` and Supabase in Frankfurt. DeepSeek processes prompts on its servers in China.
  - The README and the sign-in overlay say: don't type children's full names. The plans themselves contain no personal data.
- **Typecheck in CI** covers `api/*.ts` and the import script only. The page stays plain JS.

## Left to the builder (my calls, can be changed)

- Approach A. The page keeps its single-file, no-build form.
- Supabase over Vercel KV, Postgres or Blob, because it gives auth and RLS together and the coach's other project already uses Supabase.
- Email-code sign-in, EU region, a daily cost cap per person (see above), no service worker.
- NDJSON streaming instead of server-sent events, because a plain `fetch` reader is enough.

## Open: only the coach can decide

1. ~~Repo~~ https://github.com/minglu-prime/Sports-agent is empty. The project goes at the root.
2. ~~Who~~ Only the coach for now. Assistants can be invited later from the Supabase dashboard.
3. ~~Model~~ Decided: DeepSeek (`deepseek-flash`).
4. ~~Accounts~~ The coach has Vercel, Supabase and a DeepSeek API account. Only you see your keys; you paste them into Vercel yourself.
