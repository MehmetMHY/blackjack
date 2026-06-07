<div align="center">
  <img src="./assets/favicon.ico" width=150>
</div>

# Blackjack

## About

A browser-based [Blackjack](https://en.wikipedia.org/wiki/Blackjack) game built with vanilla JavaScript, HTML, and CSS. No frameworks or dependencies. This project was forked from [jacquelynmarcella/blackjack](https://github.com/jacquelynmarcella/blackjack) and rebuilt from the ground up using tools like [Claude Code CLI](https://code.claude.com/docs/en/cli-reference), [Gemini CLI](https://geminicli.com/), [OpenCode CLI](https://opencode.ai/docs/cli/), and [Ch CLI](https://github.com/MehmetMHY/ch).

## Features

- Full blackjack engine: hit, stand, double down, split (up to 4 hands), insurance, late surrender, even money, and dealer peek
- Natural blackjack pays 3:2, wins pay 1:1, pushes return your bet
- 6-deck shoe (H17, DAS, late surrender, no resplitting aces) with realistic ~75% penetration and automatic reshuffle
- Chip betting tray ($10, $25, $50, $100, $1000)
- Synthesized sound effects via the Web Audio API, with a mute toggle
- Looping background music with its own independent mute toggle, cached in IndexedDB so the track downloads only once
- Persistent balance, bust count, and sound/music preferences saved across sessions via localStorage
- Responsive layout, card deal and flip animations

## Running locally

No build step needed. Open `index.html` in a browser, or serve the folder over HTTP:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## Run engine simulation

```bash
node test.js
```

This runs a headless verification harness over millions of hands to measure the house edge and validate the dealer model.

## Accuracy

The engine models one specific, standard Las Vegas table: 6-deck, dealer hits soft 17 (H17), double after split allowed (DAS), late surrender, and no resplitting aces.

Verification over millions of simulated hands shows:

- Dealer bust rate around 28.5% and dealer blackjack rate around 4.75%, both matching published 6-deck H17 figures
- House edge around 0.6% to 0.7% per dollar wagered, which is the real-world number for this ruleset with basic strategy

What this means in plain terms: a player who follows basic strategy here will see the same long-run odds and make the same decisions they would at a matching real table. It is an accurate odds-and-decisions trainer.

What it does not do: teach table etiquette, hand signals, or the feel of a live pit, and it only models this one ruleset. A player who trains here and then sits at a different table (for example 6:5 payouts or stand on soft 17) will face different odds.

## Features To Add (TODO)

- [ ] Basic strategy coach mode: optionally flag when the player makes a mathematically wrong move and show the correct play. This would turn the game from "play a lot of hands" into "learn correct play," closing the gap between practice and real training.

## Swapping in real sound samples

Drop `.mp3` files into an `/audio` folder to override the synthesized effects:

```
audio/card.mp3
audio/flip.mp3
audio/chip.mp3
audio/win.mp3
audio/blackjack.mp3
audio/lose.mp3
audio/push.mp3
audio/shuffle.mp3
```

Any file present is used automatically. Missing files fall back to the synth.

## Credits

- Original project: [jacquelynmarcella/blackjack](https://github.com/jacquelynmarcella/blackjack)
- Card graphics: [OpenGameArt](https://opengameart.org/content/cards-set)
- Chip icons: [thenounproject.com](https://thenounproject.com)
- Background music: [YouTube](https://www.youtube.com/watch?v=PaFHwTjy1yE)

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
