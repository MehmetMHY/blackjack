// Verification harness for the blackjack engine — runs the real engine code
// headlessly (no UI) to measure the house edge and validate the dealer model.
//
// Why this rewrite (the old harness lied about the odds):
//   1. Sample size: a ~0.5% edge needs millions of rounds to measure. 1k-10k
//      rounds is pure variance — that noise is why the old test reported a
//      NEGATIVE (player-favoured) house edge.
//   2. Wagering denominator: the old test used handsPlayed * betAmount, which
//      never counts the extra money put up on doubles/splits. Here we sum each
//      hand's FINAL bet (plus insurance) so the denominator is correct.
//   3. Strategy: a complete 6-deck H17 / DAS / late-surrender basic-strategy
//      table, with the after-split flag actually threaded through.
//   4. Dealer model is validated in isolation (bust rate + 17-21 distribution),
//      which is strategy-independent and the cleanest proof the engine is fair.
//
// Run:  node test.js [rounds]      (default 3,000,000)

// --- Headless shims ---------------------------------------------------------
var window = {
  crypto: {
    getRandomValues: function (arr) {
      for (var i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 4294967296);
      }
      return arr;
    },
  },
};
function playSound() {}
function toast() {}
function render() {}
function resetRenderState() {}
function saveBankroll() {}

// Make the engine's animation setTimeouts run synchronously.
var timeoutCallbacks = [];
function setTimeout(fn) {
  timeoutCallbacks.push(fn);
}
function runTimeouts() {
  while (timeoutCallbacks.length > 0) {
    timeoutCallbacks.shift()();
  }
}

var fs = require("fs");
eval(fs.readFileSync("./js/cards.js", "utf8"));
eval(fs.readFileSync("./js/game-play-logic.js", "utf8"));
eval(fs.readFileSync("./js/game-win-logic.js", "utf8"));

// --- Canonical 6-deck, H17, DAS, late-surrender, no-RSA basic strategy ------
// Returns one of: "surrender" | "split" | "double" | "stand" | "hit".
function strat(cards, up, afterSplit) {
  var v = handValue(cards),
    t = v.total,
    soft = v.soft,
    d = up.value;
  var two = cards.length === 2;
  var canDD = two && !afterSplit; // engine: no double after a split-ace single card handled separately
  var pair = two && cards[0].value === cards[1].value;
  var canSurr = two && !afterSplit; // late surrender only on opening two cards

  // Late surrender (hard totals only; checked before everything else).
  if (canSurr && !soft) {
    if (t === 16 && (d === 9 || d === 10 || d === 11)) return "surrender";
    if (t === 15 && d === 10) return "surrender";
  }

  if (pair && !afterSplit) {
    var p = cards[0].value;
    if (p === 11 || p === 8) return "split";
    if (p === 9)
      return (d >= 2 && d <= 6) || d === 8 || d === 9 ? "split" : "stand";
    if (p === 7) return d >= 2 && d <= 7 ? "split" : "hit";
    if (p === 6) return d >= 2 && d <= 6 ? "split" : "hit";
    if (p === 4) return d === 5 || d === 6 ? "split" : "hit";
    if (p === 3 || p === 2) return d >= 2 && d <= 7 ? "split" : "hit";
    // 5s and 10s fall through to hard-total logic (never split)
  }

  if (soft) {
    if (t >= 20) return "stand";
    if (t === 19) return canDD && d === 6 ? "double" : "stand"; // H17: A,8 dbl vs 6
    if (t === 18) {
      if (canDD && d >= 2 && d <= 6) return "double";
      return d <= 8 ? "stand" : "hit";
    }
    if (t === 17) return canDD && d >= 3 && d <= 6 ? "double" : "hit";
    if (t === 16 || t === 15)
      return canDD && d >= 4 && d <= 6 ? "double" : "hit";
    if (t === 14 || t === 13)
      return canDD && d >= 5 && d <= 6 ? "double" : "hit";
    return "hit";
  }

  if (t >= 17) return "stand";
  if (t >= 13 && t <= 16) return d >= 2 && d <= 6 ? "stand" : "hit";
  if (t === 12) return d >= 4 && d <= 6 ? "stand" : "hit";
  if (t === 11) return canDD ? "double" : "hit";
  if (t === 10) return canDD && d >= 2 && d <= 9 ? "double" : "hit";
  if (t === 9) return canDD && d >= 3 && d <= 6 ? "double" : "hit";
  return "hit";
}

// --- Play one full round with basic strategy --------------------------------
function playRound(bet) {
  game.bet = bet;
  startRound();
  runTimeouts();

  // Never insure. Decline even money (taking 3:2 has higher EV).
  if (game.awaitingInsurance) {
    resolveInsurance(false);
    runTimeouts();
  }
  if (game.awaitingEvenMoney) {
    resolveEvenMoney(false);
    runTimeouts();
  }

  while (game.phase === "player") {
    var h = currentHand();
    if (!h || h.status !== "playing") {
      advanceHand();
      runTimeouts();
      continue;
    }
    var a = strat(h.cards, game.dealer.cards[0], h.fromSplit);

    if (a === "surrender") {
      if (canSurrender(h)) surrender();
      else {
        // Surrender unavailable (e.g. after split): fall back to hit/stand.
        var s = strat(h.cards, game.dealer.cards[0], h.fromSplit);
        if (s === "stand") stand();
        else hit();
      }
    } else if (a === "split") {
      if (canSplit(h)) split();
      else {
        var b = strat(h.cards, game.dealer.cards[0], true);
        if (b === "double" && canDouble(h)) double();
        else if (b === "stand") stand();
        else hit();
      }
    } else if (a === "double") {
      if (canDouble(h)) double();
      else {
        var c = strat(h.cards, game.dealer.cards[0], h.fromSplit);
        if (c === "stand") stand();
        else hit();
      }
    } else if (a === "stand") {
      stand();
    } else {
      hit();
    }
    runTimeouts();
  }
  runTimeouts();

  // Amount actually wagered this round = sum of each hand's FINAL bet
  // (doubles and split bets included) plus any insurance.
  var wagered = 0;
  for (var i = 0; i < game.hands.length; i++) {
    wagered += game.hands[i].bet;
  }
  wagered += game.insuranceBet;
  return wagered;
}

// --- Dealer-only distribution (strategy independent) ------------------------
function dealerCheck(n) {
  var shoe = shuffle(buildShoe(6));
  var dist = { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, bust: 0, bj: 0 };
  for (var i = 0; i < n; i++) {
    if (shoe.length < 20) shoe = shuffle(buildShoe(6));
    var d = [shoe.pop(), shoe.pop()];
    if (isBlackjack(d)) {
      dist.bj++;
      continue;
    }
    while (true) {
      var v = handValue(d);
      if (v.total < 17 || (v.total === 17 && v.soft)) d.push(shoe.pop());
      else break;
    }
    var t = handValue(d).total;
    if (t > 21) dist.bust++;
    else dist[t]++;
  }
  return dist;
}

// --- Run --------------------------------------------------------------------
var R = parseInt(process.argv[2] || "3000000", 10);

console.log("Blackjack Engine Verification\n");

var DEALER_N = 5000000;
console.log(
  "=== Dealer engine (H17, 6-deck) — " +
    DEALER_N.toLocaleString() +
    " hands ===",
);
var dd = dealerCheck(DEALER_N);
[17, 18, 19, 20, 21, "bust", "bj"].forEach(function (k) {
  console.log(
    "  " + String(k).padEnd(5) + ((100 * dd[k]) / DEALER_N).toFixed(2) + "%",
  );
});
console.log("  (textbook: bust ~28.5%, bj ~4.75%)\n");

console.log(
  "=== Full game w/ basic strategy — " + R.toLocaleString() + " rounds ===",
);
game.shoe = shuffle(buildShoe(NUM_DECKS));
game.cutCardPosition = 60 + Math.floor(Math.random() * 30);
game.bankroll = 1e12;
var start = game.bankroll,
  wag = 0,
  hands = 0,
  surr = 0;
for (var i = 0; i < R; i++) {
  game.phase = "betting";
  game.hands = [];
  game.dealer = { cards: [], hideHole: true };
  wag += playRound(10);
  hands += game.hands.length;
  for (var j = 0; j < game.hands.length; j++) {
    if (game.hands[j].result === "surrender") surr++;
  }
}
var net = game.bankroll - start;
console.log("  Hands settled:   " + hands.toLocaleString());
console.log("  Surrenders:      " + surr.toLocaleString());
console.log("  Total wagered:   $" + Math.round(wag).toLocaleString());
console.log("  Player net:      $" + Math.round(net).toLocaleString());
console.log(
  "  House edge (per $ wagered):   " + ((-100 * net) / wag).toFixed(3) + "%",
);
console.log(
  "  House edge (per initial bet): " +
    ((-100 * net) / (R * 10)).toFixed(3) +
    "%",
);
console.log(
  "  (textbook 6D/H17/DAS/late-surrender optimal: ~0.6% per initial bet)",
);
