<div align="center">
  <img src="./assets/favicon.ico" width=150>
</div>

# Blackjack

## About

A browser-based [Blackjack](https://en.wikipedia.org/wiki/Blackjack) game built with vanilla JavaScript, HTML, and CSS. No frameworks or dependencies. This project was forked from [jacquelynmarcella/blackjack](https://github.com/jacquelynmarcella/blackjack) and rebuilt from the ground up using the latest AI tools.

## Features

- Full blackjack engine: hit, stand, double down, split (up to 4 hands), insurance, late surrender, even money, and dealer peek
- Non-blocking insurance and even money prompts that keep the main action buttons stable
- Natural blackjack pays 3:2, wins pay 1:1, pushes return your bet
- 6-deck shoe (H17, DAS, late surrender, no resplitting aces) with realistic ~75% penetration and automatic reshuffle
- Chip betting tray ($10, $25, $50, $100, $1000) with hold-to-repeat betting
- Synthesized sound effects via the Web Audio API, with a mute toggle
- Looping background music with its own independent mute toggle, cached in IndexedDB so the track downloads only once
- Persistent balance, bust count, and sound/music preferences saved across sessions via localStorage
- Visit-time asset cache warming to reduce card and chip loading flashes while still revalidating on reload
- Settings menu with help, audio controls, button alignment, full restart, and source-code link
- Full Restart setting to clear saved Blackjack data, app caches, cookies, and reload fresh
- Responsive layout, card deal and flip animations

## Running Locally

No build step needed. Open `index.html` in a browser, or serve the folder over HTTP:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Keyboard Controls

- `1`-`5`: add chips ($10, $25, $50, $100, $1000)
- `C`: clear bet
- `D`: deal while betting, double during a hand
- `H` / `F`: hit
- `S`: stand
- `P`: split
- `R`: surrender, or reset when broke
- `I`: take insurance
- `E`: take even money
- `N`: decline insurance or even money
- During insurance or even money, normal action keys decline the offer first, then act if the hand continues
- `Enter` / `Space`: deal while betting, stand during a hand
- `M`: open settings
- `Esc`: open settings, or close open menus

In Settings:

- `M`: toggle music
- `S`: toggle sound effects
- `L` / `C` / `R`: set button alignment left, center, or right
- `H`: open help
- Arrow keys: choose a setting
- `Enter` / `Space`: activate selected setting, or close settings if none is selected

In Help:

- Arrow keys: scroll the help panel
- `PageUp` / `PageDown`: scroll faster

## Run Engine Simulation

```bash
node test.js
```

This runs a headless verification harness over millions of hands to measure the house edge and validate the dealer model.

## Accuracy

The engine models one specific, standard Las Vegas table: 6-deck, dealer hits soft 17 (H17), double after split allowed (DAS), late surrender, and no resplitting aces.

Verification over millions of simulated hands shows:

- Dealer bust rate around 28.5% and dealer blackjack rate around 4.75%, both matching published 6-deck H17 figures
- House edge around 0.6% per initial bet. Because basic strategy involves putting more money on the table through doubles and splits, the actual house edge per total dollar wagered is roughly 0.4%

What this means in plain terms: a player who follows basic strategy here will see the same long-run odds and make the same decisions they would at a matching real table. It is an accurate odds and decisions trainer.

What it does not do: teach table etiquette, hand signals, or the feel of a live pit, and it only models this one ruleset. A player who trains here and then sits at a different table (for example 6:5 payouts or stand on soft 17) will face different odds.

## Credits

- Original project: [jacquelynmarcella/blackjack](https://github.com/jacquelynmarcella/blackjack)
- Card graphics: [OpenGameArt](https://opengameart.org/content/cards-set)
- Chip icons: [thenounproject.com](https://thenounproject.com)
- Background music: [YouTube](https://www.youtube.com/watch?v=PaFHwTjy1yE)

## Tools Used

- [Claude Code CLI](https://code.claude.com/docs/en/cli-reference)
- [Gemini CLI](https://geminicli.com/)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [Ch CLI](https://github.com/MehmetMHY/ch)

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
