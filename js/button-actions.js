// Betting controls and player action handlers. These mutate `game` and re-render.

// --- Betting phase ----------------------------------------------------------

function addChip(amount) {
	if (game.phase !== "betting") { return; }
	if (game.bet + amount > game.bankroll) {
		toast("Not enough chips");
		return;
	}
	game.bet += amount;
	game.message = "";
	render();
}

function clearBet() {
	if (game.phase !== "betting") { return; }
	game.bet = 0;
	game.message = "";
	render();
}

function dealPressed() {
	game.message = "";
	startRound();
}

function resetBankroll() {
	game.bankroll = STARTING_BANKROLL;
	game.bet = 0;
	game.message = "";
	saveBankroll();
	render();
}
