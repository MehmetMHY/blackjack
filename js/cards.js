// Deck construction and hand-value helpers.
// Card images live in /assets and follow the pattern "<Suit>-<Rank>.png"
// where the diamonds folder name is the singular "Diamond".

var SUITS = [
  { name: "clubs", file: "Clubs" },
  { name: "diamonds", file: "Diamond" },
  { name: "hearts", file: "Hearts" },
  { name: "spades", file: "Spades" },
];

var RANKS = [
  { rank: "2", label: "2", value: 2 },
  { rank: "3", label: "3", value: 3 },
  { rank: "4", label: "4", value: 4 },
  { rank: "5", label: "5", value: 5 },
  { rank: "6", label: "6", value: 6 },
  { rank: "7", label: "7", value: 7 },
  { rank: "8", label: "8", value: 8 },
  { rank: "9", label: "9", value: 9 },
  { rank: "10", label: "10", value: 10 },
  { rank: "Ace", label: "Ace", value: 11 },
  { rank: "Jack", label: "Jack", value: 10 },
  { rank: "Queen", label: "Queen", value: 10 },
  { rank: "King", label: "King", value: 10 },
];

// Build a shoe of `numDecks` standard 52-card decks.
function buildShoe(numDecks) {
  var shoe = [];
  for (var d = 0; d < numDecks; d++) {
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        shoe.push({
          suit: SUITS[s].name,
          rank: RANKS[r].rank,
          value: RANKS[r].value,
          src: SUITS[s].file + "-" + RANKS[r].label + ".png",
        });
      }
    }
  }
  return shoe;
}

// Improved shuffle using crypto.getRandomValues for better randomness.
// Uses rejection sampling so the result is perfectly uniform (no modulo bias).
function shuffle(deck) {
  var getRandom = function (max) {
    if (window.crypto && window.crypto.getRandomValues) {
      // Discard any value at or above the largest multiple of `max` that fits
      // in a Uint32, so `% max` never favours the low end of the range.
      var limit = Math.floor(4294967296 / max) * max;
      var randomBuffer = new Uint32Array(1);
      do {
        window.crypto.getRandomValues(randomBuffer);
      } while (randomBuffer[0] >= limit);
      return randomBuffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  };

  for (var i = deck.length - 1; i > 0; i--) {
    var j = getRandom(i + 1);
    var tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

// Best total for a hand, treating aces as 11 then dropping to 1 as needed.
// Returns { total, soft } where soft means an ace is still counted as 11.
function handValue(cards) {
  var total = 0;
  var aces = 0;
  for (var i = 0; i < cards.length; i++) {
    total += cards[i].value;
    if (cards[i].rank === "Ace") {
      aces++;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total: total, soft: aces > 0 && total <= 21 };
}

// A natural blackjack: exactly two cards totalling 21.
function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards).total === 21;
}
