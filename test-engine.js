// Test harness for blackjack engine - runs simulations without UI
// This will help verify the house edge and game statistics

// Mock the required globals and functions
var window = {
  crypto: {
    getRandomValues: function(arr) {
      for (var i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 4294967296);
      }
      return arr;
    }
  }
};

// Mock functions that would normally be in other files
function playSound() {} // no-op
function toast() {} // no-op
function render() {} // no-op
function resetRenderState() {} // no-op
function saveBankroll() {} // no-op

// Override setTimeout to make it synchronous for testing
var timeoutCallbacks = [];
function setTimeout(fn, delay) {
  timeoutCallbacks.push(fn);
}
function runTimeouts() {
  while (timeoutCallbacks.length > 0) {
    var fn = timeoutCallbacks.shift();
    fn();
  }
}

// Load the game engine files
var fs = require('fs');
eval(fs.readFileSync('./js/cards.js', 'utf8'));
eval(fs.readFileSync('./js/game-play-logic.js', 'utf8'));
eval(fs.readFileSync('./js/game-win-logic.js', 'utf8'));

// Basic strategy decision maker
function getBasicStrategyAction(playerCards, dealerUpCard, isAfterSplit) {
  var playerValue = handValue(playerCards);
  var dealerValue = dealerUpCard.value;
  var soft = playerValue.soft;
  var total = playerValue.total;
  var canDoubleDown = playerCards.length === 2 && !isAfterSplit;
  var canSplitCards = playerCards.length === 2 && playerCards[0].value === playerCards[1].value && !isAfterSplit;
  
  // Simplified basic strategy
  if (canSplitCards) {
    var pairValue = playerCards[0].value;
    // Always split aces and 8s
    if (pairValue === 11 || pairValue === 8) return 'split';
    // Never split 5s or 10s - treat as regular hand
    if (pairValue === 5 || pairValue === 10) {
      // Continue to regular strategy below
    } else {
      // Split 2s, 3s, 7s against dealer 2-7
      if ((pairValue === 2 || pairValue === 3 || pairValue === 7) && dealerValue >= 2 && dealerValue <= 7) return 'split';
      // Split 6s against dealer 2-6
      if (pairValue === 6 && dealerValue >= 2 && dealerValue <= 6) return 'split';
      // Split 9s against dealer 2-9 except 7
      if (pairValue === 9 && dealerValue >= 2 && dealerValue <= 9 && dealerValue !== 7) return 'split';
    }
  }
  
  if (soft) {
    // Soft hands
    if (total >= 19) return 'stand';
    if (total === 18) {
      if (dealerValue >= 9) return 'hit';
      if (canDoubleDown && dealerValue >= 3 && dealerValue <= 6) return 'double';
      return 'stand';
    }
    if (total === 17) {
      if (canDoubleDown && dealerValue >= 3 && dealerValue <= 6) return 'double';
      return 'hit';
    }
    if (total <= 16) {
      if (canDoubleDown && total >= 13 && dealerValue >= 5 && dealerValue <= 6) return 'double';
      return 'hit';
    }
  } else {
    // Hard hands
    if (total >= 17) return 'stand';
    if (total >= 13 && total <= 16) {
      if (dealerValue >= 2 && dealerValue <= 6) return 'stand';
      return 'hit';
    }
    if (total === 12) {
      if (dealerValue >= 4 && dealerValue <= 6) return 'stand';
      return 'hit';
    }
    if (total === 11) {
      if (canDoubleDown) return 'double';
      return 'hit';
    }
    if (total === 10) {
      if (canDoubleDown && dealerValue >= 2 && dealerValue <= 9) return 'double';
      return 'hit';
    }
    if (total === 9) {
      if (canDoubleDown && dealerValue >= 3 && dealerValue <= 6) return 'double';
      return 'hit';
    }
    return 'hit';
  }
}

// Simulate a single round
function simulateRound(betAmount) {
  // Reset for new round
  game.bet = betAmount;
  
  // Start the round
  startRound();
  runTimeouts(); // Process initial deal
  
  // Handle insurance if offered
  if (game.awaitingInsurance) {
    // Basic strategy: never take insurance
    resolveInsurance(false);
    runTimeouts();
  }
  
  // Play out player hands
  while (game.phase === 'player') {
    var hand = currentHand();
    if (!hand || hand.status !== 'playing') {
      advanceHand();
      runTimeouts(); // Process any timeouts
      continue;
    }
    
    var action = getBasicStrategyAction(hand.cards, game.dealer.cards[0]);
    
    switch(action) {
      case 'hit':
        hit();
        runTimeouts();
        break;
      case 'stand':
        stand();
        runTimeouts();
        break;
      case 'double':
        if (canDouble(hand)) {
          double();
        } else {
          hit();
        }
        runTimeouts();
        break;
      case 'split':
        if (canSplit(hand)) {
          split();
        } else {
          var altAction = getBasicStrategyAction(hand.cards, game.dealer.cards[0]);
          if (altAction === 'hit') hit();
          else stand();
        }
        runTimeouts();
        break;
    }
  }
  
  // Dealer turn and settlement
  runTimeouts(); // This will process dealer turn and settlement
  
  // Return results
  var results = {
    handsPlayed: game.hands.length,
    results: game.hands.map(h => h.result),
    netWin: game.bankroll - (STARTING_BANKROLL - betAmount * game.hands.length)
  };
  
  return results;
}

// Run simulation
function runSimulation(numRounds, betAmount) {
  console.log(`Running ${numRounds} rounds with $${betAmount} bet...`);
  
  // Initialize game
  game.shoe = shuffle(buildShoe(NUM_DECKS));
  game.cutCardPosition = 60 + Math.floor(Math.random() * 30);
  game.bankroll = STARTING_BANKROLL;
  
  var stats = {
    rounds: 0,
    handsPlayed: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    busts: 0,
    totalBet: 0,
    totalReturn: 0
  };
  
  var startingBankroll = game.bankroll;
  
  for (var i = 0; i < numRounds; i++) {
    if (game.bankroll < betAmount) {
      console.log(`Bankrupt after ${i} rounds`);
      break;
    }
    
    var result = simulateRound(betAmount);
    stats.rounds++;
    stats.handsPlayed += result.handsPlayed;
    
    result.results.forEach(r => {
      if (r === 'blackjack') {
        stats.blackjacks++;
        stats.wins++;
      } else if (r === 'win') {
        stats.wins++;
      } else if (r === 'lose') {
        stats.losses++;
      } else if (r === 'push') {
        stats.pushes++;
      }
    });
    
    // Reset for next round
    game.phase = 'betting';
    game.hands = [];
    game.dealer = { cards: [], hideHole: true };
  }
  
  stats.totalBet = stats.handsPlayed * betAmount;
  stats.totalReturn = game.bankroll - startingBankroll + stats.totalBet;
  
  return stats;
}

// Run multiple simulations
console.log('Blackjack Engine Test - Basic Strategy Player\n');

var simulations = [
  { rounds: 1000, bet: 10 },
  { rounds: 5000, bet: 10 },
  { rounds: 10000, bet: 10 }
];

simulations.forEach(sim => {
  var stats = runSimulation(sim.rounds, sim.bet);
  
  console.log(`\n=== ${sim.rounds} Rounds Results ===`);
  console.log(`Hands played: ${stats.handsPlayed}`);
  console.log(`Wins: ${stats.wins} (${(stats.wins/stats.handsPlayed*100).toFixed(2)}%)`);
  console.log(`Losses: ${stats.losses} (${(stats.losses/stats.handsPlayed*100).toFixed(2)}%)`);
  console.log(`Pushes: ${stats.pushes} (${(stats.pushes/stats.handsPlayed*100).toFixed(2)}%)`);
  console.log(`Blackjacks: ${stats.blackjacks} (${(stats.blackjacks/stats.handsPlayed*100).toFixed(2)}%)`);
  console.log(`\nTotal bet: $${stats.totalBet}`);
  console.log(`Total return: $${stats.totalReturn}`);
  console.log(`Net result: $${stats.totalReturn - stats.totalBet}`);
  console.log(`House edge: ${((1 - stats.totalReturn/stats.totalBet) * 100).toFixed(2)}%`);
});

console.log('\n\nExpected results for 6-deck H17 blackjack with basic strategy:');
console.log('- House edge: ~0.5-0.6%');
console.log('- Win rate: ~42-43%');
console.log('- Loss rate: ~48-49%');
console.log('- Push rate: ~8-9%');
console.log('- Blackjack rate: ~4.75%');