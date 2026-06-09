// Settlement: compares each player hand to the dealer, applies payouts, and
// composes the outcome message. Stakes were already deducted from the bankroll
// when bets were placed, so payouts here return stake + winnings.
//
//   blackjack (natural) ... pays 3:2  -> bet * 2.5 returned
//   regular win .......... pays 1:1  -> bet * 2 returned
//   push ................. stake returned -> bet * 1 returned
//   loss ................. nothing returned
//   insurance ........... pays 2:1  -> insuranceBet * 3 returned
//
// Note: Some casinos now pay 6:5 for blackjack instead of 3:2, which increases
// the house edge significantly. We'll use the traditional 3:2 payout.

function settleRound() {
  game.phase = "settle";
  game.dealer.hideHole = false;

  var dealerTotal = handValue(game.dealer.cards).total;
  var dealerBJ = isBlackjack(game.dealer.cards);
  var dealerBust = dealerTotal > 21;

  for (var i = 0; i < game.hands.length; i++) {
    var h = game.hands[i];

    // Surrendered hands were already settled (half-bet refunded) at the moment
    // of surrender; skip them entirely so they aren't re-evaluated or paid.
    if (h.result === "surrender") {
      continue;
    }

    var total = handValue(h.cards).total;
    var playerBJ = isBlackjack(h.cards) && !h.fromSplit;
    var result,
      payout = 0;

    if (h.evenMoney) {
      // Player took even money on a natural vs a dealer Ace: guaranteed 1:1.
      result = "win";
      payout = h.bet * 2;
    } else if (total > 21) {
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
        // 3:2 on a natural. A $25 bet wins exactly $37.50, paid in casino
        // half-dollar / pink chips, so report the exact decimal (no flooring).
        return "Blackjack! You win " + h.bet * 1.5;
      case "win":
        if (h.evenMoney) {
          return "Even money — you win " + h.bet;
        }
        return "You win " + h.bet;
      case "surrender":
        return "Surrendered — half your bet returned";
      case "push":
        return "Push — bet returned";
      default:
        if (total > 21) {
          return "Bust — dealer wins";
        }
        if (dealerBJ) {
          if (game.insuranceBet > 0) {
            return "Dealer blackjack — insurance paid";
          }
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
