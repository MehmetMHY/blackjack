// Rendering, DOM wiring, persistence, and bootstrap.
// The renderer rebuilds the board from `game` on every change. Card elements
// are recreated each render, but animation classes are gated by `seen` /
// `revealed` so a card only animates on its first appearance / first reveal.

var BANKROLL_KEY = "blackjackBankroll";

var seen = {};      // card uid -> has been rendered at least once
var revealed = {};  // card uid -> has been shown face up at least once

var dom = {};

function resetRenderState() {
	seen = {};
	revealed = {};
}

function saveBankroll() {
	try { localStorage.setItem(BANKROLL_KEY, String(game.bankroll)); } catch (e) {}
}

function loadBankroll() {
	var stored = parseInt(localStorage.getItem(BANKROLL_KEY), 10);
	game.bankroll = isNaN(stored) ? STARTING_BANKROLL : stored;
}

// --- Card elements ----------------------------------------------------------

function cardEl(card, faceDown) {
	var img = document.createElement("img");
	img.className = "card";
	var isNew = !seen[card.uid];

	if (faceDown) {
		img.src = "img/card_back.png";
	} else {
		img.src = "img/" + card.src;
		if (seen[card.uid] && !revealed[card.uid]) {
			// Previously dealt face down, now revealed: flip it.
			img.classList.add("flip");
		}
		revealed[card.uid] = true;
	}

	if (isNew) { img.classList.add("dealing"); }
	seen[card.uid] = true;
	return img;
}

function badge(text, cls) {
	var span = document.createElement("span");
	span.className = "badge" + (cls ? " " + cls : "");
	span.textContent = text;
	return span;
}

// --- Render -----------------------------------------------------------------

function render() {
	renderDealer();
	renderPlayerHands();
	renderHud();
	renderControls();
	dom.message.textContent = game.message || "";
	dom.message.classList.toggle("show", !!game.message);
}

function renderDealer() {
	dom.dealerCards.innerHTML = "";
	game.dealer.cards.forEach(function (card, i) {
		var faceDown = game.dealer.hideHole && i === 1;
		dom.dealerCards.appendChild(cardEl(card, faceDown));
	});

	var text = "";
	if (game.dealer.cards.length) {
		if (game.dealer.hideHole) {
			text = String(handValue([game.dealer.cards[0]]).total);
		} else {
			text = String(handValue(game.dealer.cards).total);
		}
	}
	dom.dealerTotal.textContent = text;
	// Collapse (not just hide) the badge when empty so "Dealer" stays centered.
	dom.dealerTotal.style.display = text ? "inline-flex" : "none";
}

function renderPlayerHands() {
	dom.playerHands.innerHTML = "";

	if (!game.hands.length) { return; }

	game.hands.forEach(function (h, idx) {
		var wrap = document.createElement("div");
		var isActive = game.phase === "player" && idx === game.activeHand && !game.awaitingInsurance;
		wrap.className = "hand" + (isActive ? " active" : "");

		var cards = document.createElement("div");
		cards.className = "cards";
		h.cards.forEach(function (c) { cards.appendChild(cardEl(c, false)); });
		wrap.appendChild(cards);

		var info = document.createElement("div");
		info.className = "hand-info";

		var v = handValue(h.cards);
		var label, cls = "";
		if (isBlackjack(h.cards) && !h.fromSplit) { label = "BJ"; cls = "win"; }
		else if (v.total > 21) { label = "BUST"; cls = "bust"; }
		else { label = String(v.total); }
		info.appendChild(badge(label, cls));

		if (h.bet) {
			var bet = document.createElement("span");
			bet.className = "hand-bet";
			bet.textContent = "$" + h.bet;
			info.appendChild(bet);
		}

		if (h.result) {
			var res = document.createElement("span");
			res.className = "result " + h.result;
			res.textContent = resultLabel(h.result);
			info.appendChild(res);
		}

		wrap.appendChild(info);
		dom.playerHands.appendChild(wrap);
	});
}

function resultLabel(result) {
	switch (result) {
		case "blackjack": return "BLACKJACK";
		case "win":       return "WIN";
		case "push":      return "PUSH";
		default:          return "LOSE";
	}
}

function renderHud() {
	dom.bankroll.textContent = "$" + game.bankroll;
	dom.betAmount.textContent = game.bet ? "$" + game.bet : "";
	dom.betCircle.classList.toggle("empty", !game.bet);
}

function renderControls() {
	var betting = game.phase === "betting";
	var playerTurn = game.phase === "player" && !game.awaitingInsurance;

	dom.betControls.style.display = betting && !game.awaitingInsurance ? "" : "none";
	dom.actionControls.style.display = playerTurn ? "" : "none";
	dom.insuranceControls.style.display = game.awaitingInsurance ? "" : "none";

	var broke = betting && game.bankroll <= 0 && game.bet <= 0;
	dom.resetControls.style.display = broke ? "" : "none";

	if (betting) {
		dom.dealButton.disabled = game.bet <= 0 || game.bet > game.bankroll;
		dom.clearButton.disabled = game.bet <= 0;
	}

	if (playerTurn) {
		var h = currentHand();
		var canAct = !!h && h.status === "playing";
		dom.hitButton.disabled = !canAct;
		dom.standButton.disabled = !canAct;
		dom.doubleButton.disabled = !canDouble(h);
		dom.splitButton.disabled = !canSplit(h);
	}

	if (game.awaitingInsurance) {
		dom.insuranceCost.textContent = "$" + Math.floor(game.lastBet / 2);
	}
}

// --- Toast ------------------------------------------------------------------

var toastTimer = null;
function toast(msg) {
	dom.toast.textContent = msg;
	dom.toast.classList.add("show");
	clearTimeout(toastTimer);
	toastTimer = setTimeout(function () {
		dom.toast.classList.remove("show");
	}, 1600);
}

// --- Bootstrap --------------------------------------------------------------

function cacheDom() {
	dom.dealerCards = document.getElementById("dealer-cards");
	dom.dealerTotal = document.getElementById("dealer-total");
	dom.playerHands = document.getElementById("player-hands");
	dom.message = document.getElementById("message");
	dom.bankroll = document.getElementById("bankroll");
	dom.betAmount = document.getElementById("bet-amount");
	dom.betCircle = document.getElementById("bet-circle");
	dom.betControls = document.getElementById("bet-controls");
	dom.actionControls = document.getElementById("action-controls");
	dom.insuranceControls = document.getElementById("insurance-controls");
	dom.insuranceCost = document.getElementById("insurance-cost");
	dom.resetControls = document.getElementById("reset-controls");
	dom.toast = document.getElementById("toast");

	dom.dealButton = document.getElementById("deal-button");
	dom.clearButton = document.getElementById("clear-button");
	dom.hitButton = document.getElementById("hit-button");
	dom.standButton = document.getElementById("stand-button");
	dom.doubleButton = document.getElementById("double-button");
	dom.splitButton = document.getElementById("split-button");
}

function wireEvents() {
	var chips = document.querySelectorAll(".chip[data-amount]");
	for (var i = 0; i < chips.length; i++) {
		(function (chip) {
			chip.addEventListener("click", function () {
				addChip(parseInt(chip.dataset.amount, 10));
			});
		})(chips[i]);
	}

	dom.dealButton.addEventListener("click", dealPressed);
	dom.clearButton.addEventListener("click", clearBet);
	dom.hitButton.addEventListener("click", hit);
	dom.standButton.addEventListener("click", stand);
	dom.doubleButton.addEventListener("click", double);
	dom.splitButton.addEventListener("click", split);

	document.getElementById("insurance-yes").addEventListener("click", function () {
		resolveInsurance(true);
	});
	document.getElementById("insurance-no").addEventListener("click", function () {
		resolveInsurance(false);
	});

	document.getElementById("reset-balance-button").addEventListener("click", resetBankroll);
	document.getElementById("reset-game").addEventListener("click", function (e) {
		e.preventDefault();
		resetBankroll();
	});

	// Rules modal
	var rules = document.getElementById("rules-modal");
	document.getElementById("rules-open").addEventListener("click", function (e) {
		e.preventDefault();
		rules.classList.add("show");
	});
	document.getElementById("rules-close").addEventListener("click", function () {
		rules.classList.remove("show");
	});
	rules.addEventListener("click", function (e) {
		if (e.target === rules) { rules.classList.remove("show"); }
	});
}

document.addEventListener("DOMContentLoaded", function () {
	cacheDom();
	wireEvents();
	loadBankroll();
	game.shoe = shuffle(buildShoe(NUM_DECKS));
	render();
});
