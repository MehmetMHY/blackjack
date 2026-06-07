# Blackjack

## About

A browser-based [Blackjack](https://en.wikipedia.org/wiki/Blackjack) game built with vanilla JavaScript, HTML, and CSS. No frameworks or dependencies. This project was forked from [jacquelynmarcella/blackjack](https://github.com/jacquelynmarcella/blackjack) and rebuilt from the ground up using tools like [Claude Code CLI](https://code.claude.com/docs/en/cli-reference) and [Gemini CLI](https://geminicli.com/).

## Features

- Full blackjack engine: hit, stand, double down, split (up to 4 hands), insurance, and dealer peek
- Natural blackjack pays 3:2, wins pay 1:1, pushes return your bet
- 6-deck shoe with automatic reshuffle
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
