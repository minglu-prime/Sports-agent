# U12 备课助手

A chat-style planner for 90-minute U12 basketball sessions. It plans warm-up, mobility, neural activation, technique and a final game. It draws a court diagram for every drill, and offers a drill library, practice mode with a timer, and a German output option.

The online version (Vercel + Supabase + DeepSeek) is being built. See `docs/specs/2026-11-19-online-deployment-design.md` and `docs/superpowers/plans/2026-11-19-online-deployment.md`.

## Checks

```bash
npm install
npm test
```

- The browser test page: run `node tests/harness/build.cjs`, then `python -m http.server 8765` in `tests/harness`, and open `http://localhost:8765/page.html`.
- In the browser test page, clear `localStorage`, then run `flow.js` and `races.js`. Every value they return should be `true`.
