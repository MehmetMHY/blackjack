// Settlement: compares each player hand to the dealer, applies payouts, and
// composes the outcome message. Stakes were already deducted from the bankroll
// when bets were placed, so payouts here return stake + winnings.
//
//   blackjack (natural) ... pays 3:2  -> bet * 2.5 returned
//   regular win .......... pays 1:1  -> bet * 2 returned
//   push ................. stake returned -> bet * 1 returned
//   loss ................. nothing returned
//   insurance ........... pays 2:1  -> insuranceBet * 3 returned

function settleRound() {
  game.phase = "settle";
  game.dealer.hideHole = false;

  var dealerTotal = handValue(game.dealer.cards).total;
  var dealerBJ = isBlackjack(game.dealer.cards);
  var dealerBust = dealerTotal > 21;

  for (var i = 0; i < game.hands.length; i++) {
    var h = game.hands[i];
    var total = handValue(h.cards).total;
    var playerBJ = isBlackjack(h.cards) && !h.fromSplit;
    var result,
      payout = 0;

    if (total > 21) {
      result = "lose";
    } else if (playerBJ && !dealerBJ) {
      result = "blackjack";
      payout = h.bet * 2.5;
    } else if (dealerBJ && !playerBJ) {
      result = "lose";
    } else if (dealerBJ && playerBJ) {
      result = "push";
      payout = h.bet;
    } else if (dealerBust || total > dealerTotal) {
      result = "win";
      payout = h.bet * 2;
    } else if (total < dealerTotal) {
      result = "lose";
    } else {
      result = "push";
      payout = h.bet;
    }

    h.result = result;
    game.bankroll += payout;
  }

  // Insurance pays out only when the dealer has a natural blackjack.
  if (game.insuranceBet > 0 && dealerBJ) {
    game.bankroll += game.insuranceBet * 3;
  }

  game.message = buildOutcomeMessage(dealerBJ);
  playOutcomeSound();

  // Round over: ready the next bet and return to the betting phase.
  game.phase = "betting";
  game.awaitingInsurance = false;
  game.bet = Math.min(game.lastBet, game.bankroll);
  saveBankroll();
  render();
}

function playOutcomeSound() {
  var hasBJ = false,
    hasWin = false,
    hasPush = false;
  for (var i = 0; i < game.hands.length; i++) {
    var r = game.hands[i].result;
    if (r === "blackjack") {
      hasBJ = true;
    } else if (r === "win") {
      hasWin = true;
    } else if (r === "push") {
      hasPush = true;
    }
  }
  var sound = hasBJ ? "blackjack" : hasWin ? "win" : hasPush ? "push" : "lose";
  // Slight delay so it doesn't collide with the final card-deal sound.
  playSound(sound, 0.18);
}

function buildOutcomeMessage(dealerBJ) {
  if (game.hands.length === 1) {
    var h = game.hands[0];
    var total = handValue(h.cards).total;
    switch (h.result) {
      case "blackjack":
        return "Blackjack! You win " + Math.floor(h.bet * 1.5);
      case "win":
        return "You win " + h.bet;
      case "push":
        return "Push — bet returned";
      default:
        if (total > 21) {
          return "Bust — dealer wins";
        }
        if (dealerBJ) {
          return "Dealer blackjack — you lose";
        }
        return "Dealer wins";
    }
  }

  // Split round: summarise across all hands.
  var wins = 0,
    losses = 0,
    pushes = 0;
  for (var i = 0; i < game.hands.length; i++) {
    var r = game.hands[i].result;
    if (r === "win" || r === "blackjack") {
      wins++;
    } else if (r === "push") {
      pushes++;
    } else {
      losses++;
    }
  }
  var parts = [];
  if (wins) {
    parts.push("won " + wins);
  }
  if (pushes) {
    parts.push("pushed " + pushes);
  }
  if (losses) {
    parts.push("lost " + losses);
  }
  return "Hands: " + parts.join(", ");
}
