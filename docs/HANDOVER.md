# Hand-over (2026-11-20)

Everything needed to continue is in this repository. Nothing depends on a particular Claude account.

## Where things are

| What | Where |
|---|---|
| Live site | https://sports-agent-seven.vercel.app |
| Code | https://github.com/minglu-prime/Sports-agent, branch `main`; local checkout at `D:\claude\Sport Agent` |
| Hosting | Vercel project `sports-agent`. It deploys `main` on every merge. Preview URLs need a Vercel login. |
| Data and sign-in | Supabase project in Frankfurt: tables `docs` and `usage`, email-code sign-in, sign-ups off |
| Model | DeepSeek `deepseek-flash`, key in Vercel |
| Who the coach is and what they want | `docs/specs/2026-11-07-basketball-session-agent-design.md` |
| Why the online version looks the way it does | `docs/specs/2026-11-19-online-deployment-design.md` |
| The finished go-live plan | `docs/superpowers/plans/2026-11-19-online-deployment.md` |

The coach owns the GitHub, Vercel, Supabase and DeepSeek accounts. An assistant can't open the Vercel or Supabase dashboards; the coach does those clicks.

## State

All nine plan tasks are done. The coach tested on a real phone and tablet on 2026-11-20 and reported both work.

Checked on production:
- sign-in with the email code;
- one real plan (39 s, 9 drills, 90 minutes, validator clean) with 9 pictures, all saved;
- marking a session held, rating a drill, the library, practice mode;
- a signed-out visitor reads no rows, and a signed-in user can't read or write `usage`.

The coach's old claude.ai Artifact history was imported: 2 threads, 10 messages. The Artifact itself stays in the old Claude account and is no longer needed.

## Open items

- The English interface went live on 2026-11-20. One real English session was generated on production: valid plan, 9 pictures, no Chinese left in the interface. German drill content has not been tried on production.
- The coach has not used the English interface themselves yet.

- `DAILY_EURO_CAP` and `DEEPSEEK_MODEL` aren't validated. A non-number cap turns the cap off. An unknown model makes every call fail with a usage error.
- Start-up failures (config or the Supabase library not loading) show as a chat notice, not in the sign-in card.
- The index `docs_owner_coll` duplicates the primary key. It is harmless; a new migration could drop it.
- Row isolation was tested signed-out only. Test with a second real user when the first assistant coach is added.
- Nobody has confirmed that rows appear in the `usage` table. Look at it in Supabase after a generation.
- Pictures run with thinking off (`DEEPSEEK_PICTURE_EFFORT`, default `none`). Only 3 pictures were checked for quality that way.
- The coach hasn't used it for a real practice yet. Their feedback (wrong positions, drills that don't work with the kids) decides what to build next.
- Ideas not started: filtering library drills by players, baskets and equipment; inviting coaches from inside the app.

## Traps already hit

- **The interface is translated in the DOM** (`public/i18n.js`). A new Chinese interface text needs an English entry there; `tests/i18n.test.ts` fails until it has one. Text built from pieces with `+` is not seen whole, so write it as one template string.
- **Court spots are Chinese ids.** For English and German output, `localizeSpots` takes them out of the step text. A new spot needs an English and a German name in `SPOT_NAMES`.
- **The model writes "runs to the spot they already stand on" for a player who stays.** The layout skips that without a warning.

- **The page relied on things the Artifact host added.** A doctype, charset, viewport and a `[hidden]` rule were all missing on Vercel. The test page (`tests/harness`) now adds nothing extra, so it shows what production shows.
- **Values from the database and the model arrive frozen.** The page copies them with `editable()` before changing them. Test doubles must freeze their results too.
- **Supabase key names.** The server accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` and their older names (`lib/env.ts`). It strips a pasted `/rest/v1/` from the URL.
- **Vercel environment variables need a new deployment** before they take effect.
- **This Supabase project sends 8-digit codes.** The input takes 6 to 10 digits.
- **Add a coach with "Create new user" and "Auto Confirm User".** "Invite user" leaves them unconfirmed, and with sign-ups off they get no code.
- **Thinking mode is slow for pictures:** about 25 s each, against 5 s without it.
- **TypeScript must stay on 5.x.** Vercel compiles `api/*.ts` with the project's `typescript`, and version 7 has no compiler API.
- **A loopback address can't be fetched from the live https page** in the built-in browser. The history import passed the data through the URL fragment instead.

## How to check a change

```bash
npm test
npm run lint
```

For anything that touches the page, also run the browser test page described in the README (`flow.js` and `races.js`).
