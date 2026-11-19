# U12 备课助手

A chat-style planner for U12 basketball sessions, live at https://sports-agent-seven.vercel.app. Read `docs/HANDOVER.md` first: it has the current state, the open items and the traps.

The rules in `D:\claude\CLAUDE.md` belong to another project (Jump Attack). Only its Git workflow section applies here.

## Layers

- `public/index.html`: the whole page (UI, prompts, validator, court drawing). Plain JS, no build step.
- `public/runtime.js`: gives the page `window.claude.use("sample" | "db" | "user")` on top of Supabase and `/api/sample`.
- `api/`, `lib/`: the Vercel Functions. Logic sits in `lib/` with injected dependencies; `api/` only wires real clients.
- `supabase/migrations/`: SQL. Append new files; never edit an applied one.

## Rules

1. Write the failing test first. Don't change an existing test's expected values to make it pass.
2. Run `npm test && npm run lint` and read the result before every push.
3. Work on a feature branch, open a PR, wait for CI, merge with a merge commit, delete the branch. Conventional Commits.
4. The repo is public: no keys, no `.env*`, nothing from `exports/`.
5. Don't ask the coach for keys. They paste keys into Vercel themselves.
6. The page text is Chinese and plain, like WeChat. No flashy "AI" look.
