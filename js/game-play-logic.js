// Core game engine: a small state machine that drives a round of blackjack.
//
// Phases:
//   "betting" -> player builds a wager and presses Deal
//   "dealing" -> opening cards are being dealt / dealer peek is pending
//   "player"  -> player acts on each hand (hit/stand/double/split)
//   "dealer"  -> dealer reveals the hole card and draws (hits soft 17)
//   "settle"  -> outcomes resolved, payouts applied (transitions back to betting)
//
// Rendering is reactive: engine mutations call render() (defined in main.js),
// which rebuilds the board from `game`.

var STARTING_BANKROLL = 2000;
var NUM_DECKS = 6;
var MAX_HANDS = 4; // a pair can be split up to this many hands
var BURN_CARDS = 1; // number of cards to burn after shuffle

var cardUid = 0;

var game = {
  shoe: [],
  cutCardPosition: 0, // position where reshuffle will occur
  dealer: { cards: [], hideHole: true },
  hands: [], // array of player hands (more than one after a split)
  activeHand: 0,
  bankroll: STARTING_BANKROLL,
  bankruptcies: 0, // lifetime count of resets / busts
  bet: 0, // pending wager while in the betting phase
  lastBet: 0, // remembered for quick re-bet
  insuranceBet: 0,
  awaitingInsurance: false,
  awaitingEvenMoney: false,
  phase: "betting",
  message: "",
};

function currentHand() {
  return game.hands[game.activeHand];
}

function newHand(card, bet, fromSplit) {
  return {
    cards: card ? [card] : [],
    bet: bet,
    status: "playing", // "playing" | "stand" | "bust" | "bj" | "surrendered"
    doubled: false,
    fromSplit: !!fromSplit,
    splitAces: false,
    evenMoney: false,
    result: null,
  };
}

// Build a fresh, shuffled shoe, burn the configured number of cards, and reset
// the cut-card position. Centralised so both startRound() and draw()'s safety
// guard reshuffle identically.
function reshuffleShoe() {
  game.shoe = shuffle(buildShoe(NUM_DECKS));
  for (var i = 0; i < BURN_CARDS; i++) {
    game.shoe.pop();
  }
  // Cut card 60-89 cards from the end of a 312-card shoe gives ~71-81%
  // penetration, which is realistic for a Las Vegas 6-deck game.
  game.cutCardPosition = 60 + Math.floor(Math.random() * 30);
}

// Draw a card from the shoe, tagging it with a unique id so the renderer can
// tell which cards are new (for deal/flip animations). With 60+ cards reserved
// behind the cut card this can't happen mid-round in practice, but guard against
// an empty shoe so draw() can never throw on `card.uid`.
function draw() {
  if (game.shoe.length === 0) {
    reshuffleShoe();
  }
  var card = game.shoe.pop();
  card.uid = ++cardUid;
  return card;
}

// --- Round lifecycle --------------------------------------------------------

function startRound() {
  if (game.phase !== "betting") {
    return;
  }
  if (game.bet <= 0) {
    toast("Place a bet to play");
    return;
  }
  if (game.bet > game.bankroll) {
    toast("Not enough chips for that bet");
    return;
  }

  // Check if we've reached the cut card position
  if (game.shoe.length <= game.cutCardPosition) {
    reshuffleShoe();
    playSound("shuffle");
  }

  game.lastBet = game.bet;
  game.bankroll -= game.bet;
  game.dealer = { cards: [], hideHole: true };
  game.hands = [newHand(null, game.bet, false)];
  game.activeHand = 0;
  game.insuranceBet = 0;
  game.awaitingInsurance = false;
  game.awaitingEvenMoney = false;
  game.message = "";
  game.phase = "dealing";

  resetRenderState();

  // Standard deal order: player, dealer, player, dealer (hole).
  game.hands[0].cards.push(draw());
  game.dealer.cards.push(draw());
  game.hands[0].cards.push(draw());
  game.dealer.cards.push(draw());

  render();
  setTimeout(afterDeal, 700);
}

// After the opening deal, handle insurance and dealer/player naturals.
function afterDeal() {
  var up = game.dealer.cards[0];
  var hole = game.dealer.cards[1];

  // Check for dealer blackjack on both Ace and 10-value up cards
  if (up.rank === "Ace") {
    // When the player holds a natural against a dealer Ace, the table offers
    // "even money" (a guaranteed 1:1 payout) instead of the insurance prompt.
    // It is mathematically identical to insuring a blackjack for the full bet.
    if (isBlackjack(game.hands[0].cards)) {
      game.phase = "player";
      game.awaitingEvenMoney = true;
      render();
      return;
    }
    // Otherwise offer insurance first
    game.phase = "player";
    game.awaitingInsurance = true;
    render();
    return;
  }

  if (up.value === 10) {
    // Dealer peeks for blackjack on 10-value up card
    if (isBlackjack(game.dealer.cards)) {
      // Add slight delay to simulate peek
      setTimeout(function () {
        settleRound();
      }, 400);
      return;
    }
  }

  proceedAfterPeek();
}

function resolveInsurance(takeInsurance) {
  // Guard against stale clicks: once the offer is gone (e.g. the player already
  // acted and the dealer is drawing), ignore any further insurance input.
  if (!game.awaitingInsurance) {
    return;
  }
  game.awaitingInsurance = false;

  if (takeInsurance) {
    // Insurance is exactly half the original bet (casinos pay/take it in
    // half-dollar increments, e.g. $12.50 on a $25 bet), so don't floor it.
    var cost = game.lastBet / 2;
    if (cost > game.bankroll) {
      toast("Not enough chips for insurance");
    } else {
      game.bankroll -= cost;
      game.insuranceBet = cost;
    }
  }

  // Always check for dealer blackjack when showing an Ace
  if (isBlackjack(game.dealer.cards)) {
    settleRound();
    return;
  }

  proceedAfterPeek();
}

// Player holds a natural against a dealer Ace and is offered even money.
function resolveEvenMoney(takeEvenMoney) {
  // Guard against stale clicks: once the offer is gone, ignore further input.
  if (!game.awaitingEvenMoney) {
    return;
  }
  game.awaitingEvenMoney = false;

  if (takeEvenMoney) {
    // Guaranteed 1:1: the natural is paid even money and the round ends now,
    // regardless of whether the dealer would have had a blackjack.
    game.hands[0].status = "bj";
    game.hands[0].evenMoney = true;
    settleRound();
    return;
  }

  // Declined: fall back to the normal peek. If the dealer also has a natural
  // it's a push; otherwise the player's blackjack is paid 3:2.
  if (isBlackjack(game.dealer.cards)) {
    settleRound();
    return;
  }

  game.hands[0].status = "bj";
  settleRound();
}

function proceedAfterPeek() {
  // Dealer has no blackjack here. A player natural wins immediately.
  if (isBlackjack(game.hands[0].cards)) {
    game.hands[0].status = "bj";
    settleRound();
    return;
  }
  game.phase = "player";
  render();
}

// --- Player actions ---------------------------------------------------------

function continueAfterDecliningOffer(action) {
  if (game.awaitingInsurance) {
    resolveInsurance(false);
  } else if (game.awaitingEvenMoney) {
    resolveEvenMoney(false);
  } else {
    return false;
  }

  if (
    game.phase === "player" &&
    !game.awaitingInsurance &&
    !game.awaitingEvenMoney
  ) {
    action();
  }
  return true;
}

function hit() {
  if (continueAfterDecliningOffer(hit)) {
    return;
  }
  if (
    game.phase !== "player" ||
    game.awaitingInsurance ||
    game.awaitingEvenMoney
  ) {
    return;
  }
  var h = currentHand();
  if (h.status !== "playing") {
    return;
  }

  h.cards.push(draw());
  var total = handValue(h.cards).total;
  render();

  if (total > 21) {
    h.status = "bust";
    setTimeout(advanceHand, 650);
  } else if (total === 21) {
    h.status = "stand";
    setTimeout(advanceHand, 650);
  }
}

function stand() {
  if (continueAfterDecliningOffer(stand)) {
    return;
  }
  if (
    game.phase !== "player" ||
    game.awaitingInsurance ||
    game.awaitingEvenMoney
  ) {
    return;
  }
  var h = currentHand();
  if (h.status !== "playing") {
    return;
  }
  h.status = "stand";
  advanceHand();
}

// Late surrender: forfeit the hand for half the bet. Only legal on the opening
// two cards of an un-split hand, after the dealer has peeked for blackjack
// (which is guaranteed here because we're in the "player" phase).
function canSurrender(h) {
  return (
    !!h &&
    game.phase === "player" &&
    !game.awaitingInsurance &&
    !game.awaitingEvenMoney &&
    h.status === "playing" &&
    h.cards.length === 2 &&
    !h.fromSplit &&
    game.hands.length === 1
  );
}

function surrender() {
  if (continueAfterDecliningOffer(surrender)) {
    return;
  }
  var h = currentHand();
  if (!canSurrender(h)) {
    return;
  }

  h.status = "surrendered"; // distinct status so the dealer won't draw
  h.result = "surrender";
  // Return exactly half the (already-deducted) bet to the bankroll.
  game.bankroll += h.bet / 2;
  playSound("lose", 0.1);
  render();
  setTimeout(advanceHand, 400);
}

function canDouble(h) {
  return (
    !!h &&
    game.phase === "player" &&
    !game.awaitingInsurance &&
    !game.awaitingEvenMoney &&
    h.status === "playing" &&
    h.cards.length === 2 &&
    game.bankroll >= h.bet &&
    !h.splitAces
  );
}

function double() {
  if (continueAfterDecliningOffer(double)) {
    return;
  }
  var h = currentHand();
  if (!canDouble(h)) {
    return;
  }

  game.bankroll -= h.bet;
  h.bet *= 2;
  h.doubled = true;
  h.cards.push(draw());
  h.status = handValue(h.cards).total > 21 ? "bust" : "stand";
  render();
  setTimeout(advanceHand, 700);
}

function canSplit(h) {
  return (
    !!h &&
    game.phase === "player" &&
    !game.awaitingInsurance &&
    !game.awaitingEvenMoney &&
    h.status === "playing" &&
    h.cards.length === 2 &&
    h.cards[0].value === h.cards[1].value &&
    game.hands.length < MAX_HANDS &&
    game.bankroll >= h.bet &&
    !h.splitAces
  );
}

function split() {
  if (continueAfterDecliningOffer(split)) {
    return;
  }
  var h = currentHand();
  if (!canSplit(h)) {
    return;
  }

  game.bankroll -= h.bet;
  var movedCard = h.cards.pop();
  var sibling = newHand(movedCard, h.bet, true);
  h.fromSplit = true;

  var splittingAces = h.cards[0].rank === "Ace";
  if (splittingAces) {
    h.splitAces = true;
    sibling.splitAces = true;
  }

  // Insert the new hand directly after the current one.
  game.hands.splice(game.activeHand + 1, 0, sibling);

  // Deal one card to the current hand now; the sibling is dealt to when active.
  h.cards.push(draw());
  render();

  if (h.splitAces) {
    // Split aces receive one card each and then stand automatically.
    h.status = "stand";
    setTimeout(advanceHand, 600);
  } else if (handValue(h.cards).total === 21) {
    h.status = "stand";
    setTimeout(advanceHand, 600);
  }
}

// Move to the next hand still in play; deal its second card if it was just split.
function advanceHand() {
  var next = -1;
  for (var i = game.activeHand + 1; i < game.hands.length; i++) {
    if (game.hands[i].status === "playing") {
      next = i;
      break;
    }
  }

  if (next === -1) {
    dealerTurn();
    return;
  }

  game.activeHand = next;
  var h = game.hands[next];

  if (h.cards.length === 1) {
    // Freshly split hand needs its second card.
    h.cards.push(draw());
    render();
    if (h.splitAces) {
      h.status = "stand";
      setTimeout(advanceHand, 500);
      return;
    }
    if (handValue(h.cards).total === 21) {
      h.status = "stand";
      setTimeout(advanceHand, 500);
      return;
    }
  } else {
    render();
  }
}

// --- Dealer turn ------------------------------------------------------------

function dealerTurn() {
  game.phase = "dealer";
  game.dealer.hideHole = false;
  render();

  // If every player hand busted or surrendered, the dealer needn't draw.
  var anyAlive = false;
  for (var i = 0; i < game.hands.length; i++) {
    var hand = game.hands[i];
    if (hand.status !== "surrendered" && handValue(hand.cards).total <= 21) {
      anyAlive = true;
      break;
    }
  }
  if (!anyAlive) {
    setTimeout(settleRound, 800);
    return;
  }

  setTimeout(dealerStep, 800);
}

function dealerStep() {
  // H17: dealer hits on hard 16 or less AND on soft 17, otherwise stands.
  // This is the standard 6-deck Vegas shoe rule.
  var dv = handValue(game.dealer.cards);

  // Must hit if:
  // - Total is less than 17
  // - Total is exactly 17 AND it's soft (has an ace counted as 11)
  var mustHit = dv.total < 17 || (dv.total === 17 && dv.soft);

  if (mustHit) {
    game.dealer.cards.push(draw());
    render();
    // Check if dealer busted
    if (handValue(game.dealer.cards).total > 21) {
      setTimeout(settleRound, 500);
    } else {
      setTimeout(dealerStep, 800);
    }
  } else {
    setTimeout(settleRound, 500);
  }
}
