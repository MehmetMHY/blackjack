# AGENTS.md

Guidance for AI agents working in this repository.

## Project Overview

This is a browser-based Blackjack game built with plain HTML, CSS, and vanilla JavaScript. There is no framework, package manager, bundler, transpiler, or build step.

The app runs directly from `index.html` and loads JavaScript files as classic global scripts in this order:

1. `js/sounds.js`
2. `js/music.js`
3. `js/cards.js`
4. `js/game-play-logic.js`
5. `js/game-win-logic.js`
6. `js/button-actions.js`
7. `js/main.js`

That load order matters. Functions and variables are shared through the global scope, not modules.

## Repository Layout

- `index.html`: static markup, game controls, settings modal, rules/help modal, script includes, and metadata.
- `css/style.css`: main layout and responsive styling for the table, cards, controls, modals, and mobile/PWA behavior.
- `css/keyframes.css`: card deal and flip animations.
- `js/cards.js`: deck construction, shuffle, hand-value helpers, blackjack detection.
- `js/game-play-logic.js`: core game state machine and player/dealer actions.
- `js/game-win-logic.js`: settlement, payouts, outcome messages, bankroll persistence triggers.
- `js/button-actions.js`: betting controls and reset handlers.
- `js/main.js`: DOM rendering, event wiring, keyboard controls, persistence, settings, asset cache warming, bootstrap.
- `js/sounds.js`: synthesized sound effects and optional `/audio/*.mp3` overrides.
- `js/music.js`: background music playback and IndexedDB blob cache.
- `assets/`: card images, chip images, favicons, thumbnail, GitHub icon, and `music.mp3`.
- `test.js`: Node-based headless verification harness for odds/dealer-model simulation.

## Running Locally

Open `index.html` directly in a browser, or serve the directory over HTTP:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

Prefer HTTP serving when checking audio, cache behavior, IndexedDB, fetch-based asset warming, or mobile browser behavior. `file://` can change fetch/audio behavior.

## Git And Worktree Safety

- The worktree may contain user changes. Do not overwrite, revert, or clean up changes you did not make unless the user explicitly asks.
- Do not run destructive commands such as `git reset --hard`, `git checkout --`, or broad file removal commands unless explicitly approved.
- Do not commit, amend, tag, push, force-push, or create pull requests unless the user explicitly requests it.
- Before any requested commit, inspect `git status` and the diff, then stage only intended files.
- If unrelated files are modified, leave them alone and mention them only if they affect the task.

## Verification Commands

There is no lint or unit-test command configured.

Run the engine simulation with:

```bash
node test.js
```

`node test.js` defaults to 3,000,000 full game rounds and also runs a 5,000,000-hand dealer check, so it can be slow. For quick smoke testing after engine changes, use a smaller round count:

```bash
node test.js 10000
```

Note that the dealer-only check is currently fixed at 5,000,000 hands even when a smaller round count is supplied.

For UI changes, manually verify in a browser because there is no automated browser test suite. Check desktop and mobile-width layouts, especially card spacing, control positioning, modals, keyboard shortcuts, and touch/click interactions.

## Architecture Notes

- `game` in `js/game-play-logic.js` is the single mutable game-state object.
- Rendering is intentionally rebuild-based: engine mutations call `render()` from `js/main.js`, which reconstructs visible DOM from `game`.
- Card animation state is tracked separately in `seen` and `revealed` in `js/main.js`; call `resetRenderState()` at the start of a new round.
- Cards are assigned `uid` in `draw()` so render logic can distinguish new/revealed cards.
- Dealer rule is H17: dealer hits soft 17. Keep this aligned across game logic, README, rules modal, and `test.js`.
- Table rules modeled here: 6 decks, dealer hits soft 17, double after split allowed except split aces, late surrender, no resplitting aces, max 4 hands, blackjack pays 3:2.
- Bets are deducted when placed/acted on; settlement returns stake plus winnings.
- Insurance is exactly half of the original bet and may be fractional, for example `$12.50` on a `$25` bet.
- Sound effects are synthesized by default; optional local overrides are ignored by git via the `audio/` directory.
- Background music has its own mute state and caches `assets/music.mp3` in IndexedDB database `blackjack-audio`.

## Code Style

- Use ES5-style JavaScript to match the existing code: `var`, function declarations, IIFEs, and classic scripts.
- Do not introduce modules, bundlers, TypeScript, npm dependencies, or framework code unless explicitly requested.
- Do not add dependencies or external build tooling without user approval. This project is intentionally dependency-free and runs as static files.
- Keep globals intentional and named clearly. Because scripts share one global scope, avoid generic names that could collide.
- Preserve the existing formatting style: two-space indentation in HTML/CSS/JS, double quotes in JavaScript strings, semicolons, and section comments like `// --- Section ---` where helpful.
- Keep changes small and direct. Prefer editing existing functions over adding new abstraction layers unless reuse is clear.
- Use defensive browser API checks where existing code does, especially for audio, storage, IndexedDB, caches, and fetch.
- Keep comments only where they explain non-obvious behavior, browser quirks, game rules, or payout math.
- Do not use em dashes in code, docs, comments, or user-facing text. Use commas, parentheses, colons, or hyphens instead.

## UI And CSS Guidance

- The UI is intentionally responsive and mobile-conscious. Avoid changes that only work on desktop.
- The game should work well and look polished on both desktop and mobile. Treat mobile layout, touch interaction, and desktop spacing as first-class requirements.
- Preserve iOS/mobile safeguards in `css/style.css`, including safe-area padding, overscroll/background handling, touch behavior, and compact viewport logic.
- Layout stability is important: several elements reserve height/width to prevent controls, labels, cards, and messages from jumping. Be careful when changing `min-height`, fixed tracks, visibility/opacity hiding, and reserved label/badge space.
- The visual language is casino felt green, gold accents, rounded chips/buttons, Playfair Display for brand/outcome text, and Poppins for UI text.
- Card asset paths must match the existing pattern in `assets/`: `<Suit>-<Rank>.png`, with diamond files using singular `Diamond`.

## Desktop And Mobile Quality

- Verify that the primary game flow remains usable on narrow mobile screens and larger desktop screens.
- On mobile, controls should stay reachable, cards should not become too small, modals should scroll correctly, and safe-area padding should avoid notches and home indicators.
- On desktop, the table should feel centered and intentional, with stable spacing, readable cards, and no awkward excessive gaps on common window sizes.
- Check both pointer/touch behavior and keyboard controls when UI changes affect interactions.
- A useful manual smoke check is around `375px` wide for mobile and around `1440px` wide for desktop, plus one short-height desktop window if layout code changed.

## Performance And Startup

- Keep startup light. Avoid blocking work during page load, large synchronous loops, or unnecessary DOM churn outside the existing render path.
- Be careful with asset warming and preload changes. Extra large assets or aggressive fetches can hurt first load, especially on mobile.
- Avoid adding timers, intervals, or animation loops that continue running when they are not needed.
- Preserve the direct static-app model: no server requirement, no build step, and no runtime dependency on external JavaScript services.

## Gameplay Change Checklist

When changing rules or engine behavior, update all affected places:

- Runtime logic in `js/game-play-logic.js`, `js/game-win-logic.js`, and/or `js/cards.js`.
- UI enable/disable logic in `js/main.js` if actions or phases change.
- Button or keyboard handlers in `js/button-actions.js` and `js/main.js` if controls change.
- Script includes in `index.html` if a new JavaScript file is added. Preserve global dependency order and document why the new position is safe.
- User-facing rules/help text in `index.html`.
- Feature/rules documentation in `README.md`.
- Agent guidance in `AGENTS.md` when the change affects future development workflow, architecture, commands, conventions, or verification guidance.
- Headless strategy or verification assumptions in `test.js`.

Run `node test.js 10000` or a larger simulation after meaningful engine changes. For payout/rule changes, inspect output for plausible dealer bust/blackjack rates and house edge direction, but remember short simulations are noisy.

## Persistence And Reset Behavior

The app stores data under keys beginning with `blackjack`:

- `blackjackBankroll`
- `blackjackBankruptcies`
- `blackjackButtonAlign`
- `blackjackMuted`
- `blackjackMusicMuted`

Full Restart in settings clears Blackjack local/session storage, visible cookies, caches whose names include `blackjack`, the `blackjack-audio` IndexedDB database, and reloads with a cache-busting query parameter. Preserve this behavior when touching persistence.

## Accessibility And Input

- Keyboard shortcuts are documented in `README.md` and the rules modal. Keep both in sync with `handleKeyboard()` in `js/main.js`.
- Important controls are real `button` elements or links. Continue using semantic controls for new interactions.
- Offer banners use `aria-live="polite"`; avoid replacing this with blocking prompts for normal gameplay.
- Browser autoplay restrictions are expected. Music starts on the first pointer or key gesture if immediate playback is blocked.

## Asset Guidelines

- Do not rename or move existing assets without updating `assetPaths()` in `js/main.js`, markup references, CSS references, and card construction in `js/cards.js`.
- Keep generated/local audio overrides in `audio/`; that directory is gitignored.
- Avoid committing OS/editor files. `.DS_Store`, `.vscode/`, `.idea/`, `.opencode/`, `.claude/`, and similar files are ignored.

## Before Finishing Work

- For docs-only changes, inspect the changed file for accuracy against the current repo.
- After any code or behavior change, update `README.md` and `AGENTS.md` when the change affects user-facing features, rules, commands, architecture, workflow, or future-agent instructions.
- For JavaScript engine changes, run at least a smoke simulation with `node test.js 10000` when time allows.
- For UI changes, serve locally and test the primary flow: place bet, deal, hit, stand, double, split when possible, surrender, insurance/even money offer if reachable, reset, settings, and keyboard shortcuts.
- Check both a narrow mobile viewport and a desktop viewport for layout regressions.
