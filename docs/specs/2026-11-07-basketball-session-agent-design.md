# U12 Basketball Session Agent: Design

Status: draft, written while the Artifact spike is in testing. Owner: the coach (user). "My call" marks decisions Claude made that the coach has not confirmed yet.

## Intent

A youth basketball coach in Germany prepares 90-minute U12 sessions. Preparation is slow because each session must be fun **and** effective, the warm-up must really warm the kids up (cold halls in winter), and the activation games must not repeat week after week. The coach wants to state a need on a phone ("this week: fast break, 14 kids, cold hall") and get a ready German session plan with drill cards, so that 15 minutes before practice is enough to prepare.

Coaching philosophy (the coach's, non-negotiable): coordination, reaction and speed come before everything else. Every drill is a game with a competition or score; rigid drills lose U12 kids and make the group hard to manage.

## Goals

1. Generate a complete session in German from a few inputs, on a phone, in under a minute.
2. Fixed five-part structure, in this order:
   1. `aufwaermen`: running games that raise core temperature first.
   2. `mobilisation`: playful dynamic mobility and elasticity, e.g. single-leg hops, animal walks.
   3. `aktivierung`: reaction and neural activation, e.g. head-chest-ball, 2-player ball chase.
   4. `technik`: the weekly focus as game forms, e.g. long outlet pass, 2-on-1, catch-and-shoot.
   5. `spiel`: a real game, at least 20 minutes, with one rule tied to the focus.
3. No repetition: activation games must not repeat within the last 4 sessions. Other drills should vary too.
4. Each drill card contains: name, minutes, goals (Koordination / Reaktion / Schnelligkeit / Technik / …), setup, rules, competition/scoring, one coaching cue, easier and harder variants.
5. Swap a single drill without regenerating the session.
6. Shareable with assistant coaches and other coaches. Each coach has their own session history.
7. Works locally and in the cloud: the coach can use it from any phone. "Locally" also means it can run on the coach's own machine for development.

## Non-goals

- No player tracking, attendance, stats or video analysis.
- No season or macro periodization in v1. Weekly focus is entered by hand.
- No native app-store app in v1.
- No general multi-sport support in v1. U10 and U14 inputs exist, but U12 is the target.

## Anti-goals (failure even if it "works")

- Plans that read like a textbook: static stretching blocks, long queues, drills without a competition.
- The same activation game every week.
- A warm-up that skips core temperature in a cold hall.
- A session that overruns the time, or a final game shorter than 20 minutes.
- Silent fixes. When a rule check fails, the coach sees which rule failed.
- Sending kids' or coaches' data to third parties beyond the LLM call itself.

## Constraints

- Output language: German. Input in German or Chinese is accepted. (My call: the UI is German too.)
- Phone-first, usable one-handed in a gym. Readable at arm's length in the hall: large type, high contrast, light and dark mode.
- Deterministic rule checks live in code, not in the prompt:
  - total minutes equal the planned duration;
  - each phase's minutes equal the sum of its drills;
  - phase order is fixed;
  - final game is at least the configured minimum (default 20);
  - a cold hall needs at least 10 warm-up minutes (my call, adjustable);
  - no activation drill repeats from the last 4 sessions;
  - no duplicate drill names.
- One automatic repair round: the LLM gets the list of violations. If the plan still fails, it is shown with the violations listed.
- Error, loading and empty states are explicit, and raw error codes are visible.

## What exists now (spike, throwaway)

- Artifact: https://claude.ai/artifact/XaWyvoDdCmNobgx5Wic7m7 (private).
- A single HTML page. Claude generates the plan through the artifact `sample` capability, using the viewer's own Claude account. The `db` capability keeps per-user private history at `data/users/<id>`.
- Implemented: the form, generate with one repair round, the validator, the to-scale minute bar, phase drill cards, "Andere Übung" swap, "Als gehalten speichern", history, and copying the plan as text.
- No curated drill library. Variety comes from the LLM plus the history exclusion list.

Lessons from spike testing go in a section added below this one before the build starts.

## Decided: how it gets made

- **Core logic is portable and framework-free** (my call). The pieces are:
  - phase definitions;
  - the prompt builders;
  - JSON schemas for the plan and the drill;
  - the validator;
  - the plan-to-text formatter.

  Together they form one plain TypeScript/JS module with unit tests. Both the Artifact and the later app use it.
- **Delivery target: the Artifact only.** Zero hosting. Each coach uses their own Claude account, and sharing is by artifact link, so coaches must be able to open claude.ai. A standalone PWA with a central API key is out of scope (see "Decided by the coach"). The core module stays framework-free so that option remains open.
- **Local use:** the core module and its tests run locally with Node. The page can be previewed locally, but Claude generation works only inside claude.ai.

## Drill library (v2)

Curated drills move generation from "invent" to "pick, adapt and occasionally invent". This improves quality and gives repeat control by id instead of by name.

- Fields: `id`, `name_de`, `phase`, `ziele[]`, `min_players`, `max_players`, `baskets_needed`, `equipment[]`, `minutes_range`, `setup`, `rules`, `competition`, `coaching_cue`, `easier`, `harder`, `tags[]` (e.g. `kalt-geeignet`, `schnellangriff`), `source` (`coach` / `llm`), `rating` (coach thumbs up/down after practice).
- The library, the history and the ratings are all per coach, stored privately under `data/users/<id>` (see "Decided by the coach").
- The LLM receives filtered candidates and must return library ids where it uses a library drill. A new invented drill can be saved into the library with one tap.

## German glossary (keep wording consistent)

| Term | Meaning |
|---|---|
| Aufwärmen | warm-up |
| Mobilisation & Sprungkraft | mobility and elasticity |
| Neuro-Aktivierung | neural activation |
| Technik | technique block |
| Abschlussspiel | final game |
| Übung | drill |
| Aufbau | setup |
| Regeln | rules |
| Wettkampf | competition/scoring |
| Coaching-Cue | coaching cue |
| Leichter / Schwerer | easier / harder |
| Schwerpunkt der Woche | weekly focus |
| Halle kalt | cold hall |
| Als gehalten speichern | mark as held |

## Left to the builder

- Visual design, within the phone-first and arm's-length readability constraints.
- Prompt wording, as long as the rules above are enforced in code.
- Model tier choice; cost is a concern, so default to a mid tier.
- Test framework and repo layout.

## Spike lessons so far (2026-11-14)

- The page needs a claude.ai login in the phone browser. The coach first hit the login wall and could not use the page.
- The coach rejected the form UI and the dark "AI agent" UI. The page is now a WeChat-like chat:
  - The coach states needs in plain words.
  - Each plan arrives as a card inside a chat bubble.
  - Old plans are reused with **基于这个改** (quote and edit).
  - **标记已上课** marks a plan as held. Held plans feed the no-repeat rule.
  - The chat is stored per coach at `data/users/<id>/chat/msgs`.
- During self-testing the language is Chinese. German returns when the team uses it. This overrides the "Output language: German" constraint for now.
- The spike already has a minimal drill library (version 10). It is the coach's decision 3, kept small:
  - Every drill on a held plan has **👍 孩子喜欢** and **👎 不再用**.
  - Each rating is stored at `data/users/<id>/lib_<hash of drill name>`, together with the full drill and its picture.
  - The newest 30 liked drills go into the prompt as preferred picks.
  - Disliked drills are a validator rule, so they trigger the repair round.
  - A liked drill's saved picture is reused when the same drill name comes back, which saves a Claude call.
  - It does not filter by players, baskets or equipment yet. That waits until the library grows past about 30 drills.
- Every drill has **换一个**. It sends a quoted chat message that swaps only that drill and keeps its minutes.
- **▶ 上课** (v11) opens practice mode:
  - one drill per screen, with a countdown;
  - the countdown runs on wall-clock time, so a locked phone does not slow it down;
  - the phone vibrates when time is up, and the screen asks to stay on;
  - at the end there is a shortcut to **标记已上课**.
- Edits keep pictures (v12). A drill with the same name and rules as in the quoted plan keeps its picture. Pictures are never sent back to Claude in prompts.
- An independent code review found thread races, fixed in v14:
  - a fast second message created a second thread;
  - switching threads mid-request wrote messages and the held record to the wrong thread;
  - a picture without a court diagram was saved as if it were done.
  - Now every write uses the thread id captured before the first await. The races are reproduced in `spike/harness/races.js`.
- Library view (v15–v16) in the sidebar:
  - 👍 drills are grouped by phase, and a wrong 👎 can be undone;
  - **排进下节课** prefills the message box;
  - activation drills used in the last 4 sessions cannot be scheduled.
- Rendering (v17–v18): messages are rebuilt only when they change. Re-rendering a 20-plan thread went from 470 ms to 0 ms, measured in the harness on desktop.
- Prompt evaluation (v19). A separate model answered the exact prompts, and the answers are kept in `spike/prompt-eval`.
  - Both plans, Chinese and German, passed the validator.
  - Both pictures laid out without problems.
  - A floor ball could not be drawn. The detail prompt now offers `typ:"ball"`.
- Second code review (v20–v21) fixed:
  - null entries in a model answer crashed the thread on every load. `cleanPlan` now drops them.
  - the no-repeat window now sorts by `heldAt`, the time a session was marked held, instead of plan creation time.
  - a picture is carried over only when the setup (aufbau) is also unchanged.
  - sending while a thread loads is refused with a notice.
  - an arrow too short to draw is reported instead of drawn backwards.
- Output language (v13). A setting switches the drill content and the copy text to German, using the glossary phase names. The page UI stays Chinese. Court spot names stay Chinese because they are program ids.

## Calls settled after builder review (my calls)

- **Build step is fine.** The shared core module is bundled into the Artifact's single HTML with esbuild (inline output). The spike's validator and prompt code is the starting point. It gets ported into the module with unit tests, not rewritten from scratch.
- **The history window counts held sessions only**, meaning the ones saved with "Als gehalten speichern". Unsaved generations do not count. A saved session stores its final drills, swaps included.
- **Input language:** structured inputs are form fields. Only the free-text fields (focus, notes) may be in Chinese, and the output is always German. One test case uses a Chinese focus and checks that the output is German.
- **Milestones:** v1 is the core module, the Artifact, and spike lessons applied. v2 is the drill library. The PWA comes only when the trigger below is met.
- **Spike lessons gate the build.** No build plan is written until the coach has used the spike for at least one real session and its lessons are recorded here.

## Decided by the coach (2026-11-07)

1. **Sharing:** every coach uses the same Artifact link and has a private history. Plans are passed along with "Als Text kopieren". There is no shared team history.
2. **Cost:** each coach uses their own claude.ai account. The Artifact stays the only delivery target. The PWA, central API key and Supabase are out of scope until coaches without claude.ai accounts need access. That would be a new decision.
3. **Drill library:** it grows from use. After a held session the coach rates each drill with thumbs up or down. Drills rated up enter the coach's personal library, which is stored per user in `db`. Later generations prefer library drills that match the phase, players, baskets and equipment, and still avoid recent repeats. Nothing is seeded upfront.
