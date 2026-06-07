// Rendering, DOM wiring, persistence, and bootstrap.
// The renderer rebuilds the board from `game` on every change. Card elements
// are recreated each render, but animation classes are gated by `seen` /
// `revealed` so a card only animates on its first appearance / first reveal.

var BANKROLL_KEY = "blackjackBankroll";
var BANKRUPT_KEY = "blackjackBankruptcies";
var ALIGN_KEY = "blackjackButtonAlign";

var seen = {}; // card uid -> has been rendered at least once
var revealed = {}; // card uid -> has been shown face up at least once
var cardSoundCount = 0; // staggers deal sounds within a single render pass

var dom = {};

function playSound(name, delay) {
  if (typeof Sound !== "undefined") {
    Sound.play(name, delay);
  }
}

function resetRenderState() {
  seen = {};
  revealed = {};
}

function saveBankroll() {
  try {
    localStorage.setItem(BANKROLL_KEY, String(game.bankroll));
  } catch (e) {}
}

function loadBankroll() {
  var stored = parseInt(localStorage.getItem(BANKROLL_KEY), 10);
  game.bankroll = isNaN(stored) ? STARTING_BANKROLL : stored;
}

function saveBankruptcies() {
  try {
    localStorage.setItem(BANKRUPT_KEY, String(game.bankruptcies));
  } catch (e) {}
}

function loadBankruptcies() {
  var n = parseInt(localStorage.getItem(BANKRUPT_KEY), 10);
  game.bankruptcies = isNaN(n) ? 0 : n;
}

// --- Card elements ----------------------------------------------------------

function cardEl(card, faceDown) {
  var img = document.createElement("img");
  img.className = "card";
  var isNew = !seen[card.uid];

  if (faceDown) {
    img.src = "assets/card_back.png";
  } else {
    img.src = "assets/" + card.src;
    if (seen[card.uid] && !revealed[card.uid]) {
      // Previously dealt face down, now revealed: flip it.
      img.classList.add("flip");
      playSound("flip");
    }
    revealed[card.uid] = true;
  }

  if (isNew) {
    img.classList.add("dealing");
    // Stagger so the opening deal sounds like several cards, not one snap.
    playSound("card", cardSoundCount * 0.06);
    cardSoundCount++;
  }
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
  cardSoundCount = 0;
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
  // Keep the badge's box reserved (hide, don't collapse) so the "Dealer" label
  // doesn't jump sideways when the total appears and disappears each round.
  dom.dealerTotal.style.visibility = text ? "visible" : "hidden";
}

function renderPlayerHands() {
  dom.playerHands.innerHTML = "";

  if (!game.hands.length) {
    return;
  }

  game.hands.forEach(function (h, idx) {
    var wrap = document.createElement("div");
    var isActive =
      game.phase === "player" &&
      idx === game.activeHand &&
      !game.awaitingInsurance;
    wrap.className = "hand" + (isActive ? " active" : "");

    var cards = document.createElement("div");
    cards.className = "cards";
    h.cards.forEach(function (c) {
      cards.appendChild(cardEl(c, false));
    });
    wrap.appendChild(cards);

    var info = document.createElement("div");
    info.className = "hand-info";

    var v = handValue(h.cards);
    var label,
      cls = "";
    if (isBlackjack(h.cards) && !h.fromSplit) {
      label = "BJ";
      cls = "win";
    } else if (v.total > 21) {
      label = "BUST";
      cls = "bust";
    } else {
      label = String(v.total);
    }
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
    case "blackjack":
      return "BLACKJACK";
    case "win":
      return "WIN";
    case "push":
      return "PUSH";
    case "surrender":
      return "SURRENDER";
    default:
      return "LOSE";
  }
}

function renderHud() {
  dom.bankroll.textContent = "$" + game.bankroll;
  dom.bustCount.textContent = game.bankruptcies;
  dom.betAmount.textContent = game.bet ? "$" + game.bet : "";
  dom.betCircle.classList.toggle("empty", !game.bet);
}

function renderControls() {
  var betting = game.phase === "betting";
  var playerTurn =
    game.phase === "player" &&
    !game.awaitingInsurance &&
    !game.awaitingEvenMoney;

  // Chips stay on the table at all times; only enabled when a bet can be placed.
  dom.chipTray.classList.toggle("disabled", !(betting && game.bankroll > 0));

  var broke = betting && game.bankroll <= 0 && game.bet <= 0;
  var showBet =
    betting && !game.awaitingInsurance && !game.awaitingEvenMoney && !broke;

  dom.betControls.classList.toggle("active", showBet);
  dom.actionControls.classList.toggle("active", playerTurn);
  dom.insuranceControls.classList.toggle("active", !!game.awaitingInsurance);
  dom.evenMoneyControls.classList.toggle("active", !!game.awaitingEvenMoney);
  dom.resetControls.classList.toggle("active", broke);

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
    dom.surrenderButton.disabled = !canSurrender(h);
  }

  if (game.awaitingInsurance) {
    // Insurance is exactly half the bet (e.g. $12.50 on a $25 bet).
    dom.insuranceCost.textContent = "$" + game.lastBet / 2;
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
  dom.bustCount = document.getElementById("bust-count");
  dom.betAmount = document.getElementById("bet-amount");
  dom.betCircle = document.getElementById("bet-circle");
  dom.chipTray = document.getElementById("chip-tray");
  dom.betControls = document.getElementById("bet-controls");
  dom.actionControls = document.getElementById("action-controls");
  dom.insuranceControls = document.getElementById("insurance-controls");
  dom.insuranceCost = document.getElementById("insurance-cost");
  dom.evenMoneyControls = document.getElementById("even-money-controls");
  dom.resetControls = document.getElementById("reset-controls");
  dom.toast = document.getElementById("toast");

  dom.dealButton = document.getElementById("deal-button");
  dom.clearButton = document.getElementById("clear-button");
  dom.hitButton = document.getElementById("hit-button");
  dom.standButton = document.getElementById("stand-button");
  dom.doubleButton = document.getElementById("double-button");
  dom.splitButton = document.getElementById("split-button");
  dom.surrenderButton = document.getElementById("surrender-button");
}

// --- Button alignment -------------------------------------------------------

function applyAlignment(val) {
  var controls = document.querySelector(".controls");
  controls.classList.remove("align-left", "align-center", "align-right");
  if (val === "left" || val === "right") {
    controls.classList.add("align-" + val);
  }
  // Update toggle button highlight
  var btns = document.querySelectorAll(".align-toggle-btn");
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle("active", btns[i].dataset.align === val);
  }
}

function loadAlignment() {
  var stored = localStorage.getItem(ALIGN_KEY);
  applyAlignment(stored || "center");
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
  dom.surrenderButton.addEventListener("click", surrender);

  document
    .getElementById("insurance-yes")
    .addEventListener("click", function () {
      resolveInsurance(true);
    });
  document
    .getElementById("insurance-no")
    .addEventListener("click", function () {
      resolveInsurance(false);
    });
  document
    .getElementById("even-money-yes")
    .addEventListener("click", function () {
      resolveEvenMoney(true);
    });
  document
    .getElementById("even-money-no")
    .addEventListener("click", function () {
      resolveEvenMoney(false);
    });

  // SVG icons
  var SVG_SETTINGS =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
  var SVG_SOUND_ON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
  var SVG_SOUND_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
  var SVG_MUSIC_ON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
  var SVG_MUSIC_OFF =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';

  // Settings button in topbar
  var settingsOpen = document.getElementById("settings-open");
  var settingsModal = document.getElementById("settings-modal");
  settingsOpen.innerHTML = SVG_SETTINGS;
  function openSettings() {
    updateMuteIcon();
    updateMusicIcon();
    settingsModal.classList.add("show");
  }
  settingsOpen.addEventListener("click", function (e) {
    e.preventDefault();
    openSettings();
  });
  document.getElementById("settings-close").addEventListener("click", function () {
    settingsModal.classList.remove("show");
  });
  settingsModal.addEventListener("click", function (e) {
    if (e.target === settingsModal) {
      settingsModal.classList.remove("show");
    }
  });

  // Sound mute toggle (inside settings modal)
  var muteButton = document.getElementById("mute-button");
  function updateMuteIcon() {
    muteButton.innerHTML = Sound.isMuted() ? SVG_SOUND_OFF : SVG_SOUND_ON;
  }
  updateMuteIcon();
  muteButton.addEventListener("click", function (e) {
    e.preventDefault();
    Sound.toggleMute();
    updateMuteIcon();
  });

  // Music toggle (inside settings modal)
  var musicButton = document.getElementById("music-button");
  function updateMusicIcon() {
    musicButton.innerHTML = Music.isMuted() ? SVG_MUSIC_OFF : SVG_MUSIC_ON;
  }
  updateMusicIcon();
  musicButton.addEventListener("click", function (e) {
    e.preventDefault();
    Music.toggleMute();
    updateMusicIcon();
  });

  document
    .getElementById("reset-balance-button")
    .addEventListener("click", resetBankroll);

  // Reset game (inside settings modal — closes modal then resets)
  document.getElementById("reset-game").addEventListener("click", function (e) {
    e.preventDefault();
    settingsModal.classList.remove("show");
    resetBankroll();
  });

  // Button alignment toggle
  var alignBtns = document.querySelectorAll(".align-toggle-btn");
  for (var i = 0; i < alignBtns.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var val = btn.dataset.align;
        try { localStorage.setItem(ALIGN_KEY, val); } catch (e) {}
        applyAlignment(val);
      });
    })(alignBtns[i]);
  }

  // Rules modal — opened from settings modal
  var rules = document.getElementById("rules-modal");
  document.getElementById("rules-open").addEventListener("click", function (e) {
    e.preventDefault();
    settingsModal.classList.remove("show");
    rules.classList.add("show");
  });
  document.getElementById("rules-close").addEventListener("click", function () {
    rules.classList.remove("show");
  });
  rules.addEventListener("click", function (e) {
    if (e.target === rules) {
      rules.classList.remove("show");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  cacheDom();
  wireEvents();
  Sound.preload();
  Music.init();
  loadBankroll();
  loadBankruptcies();
  loadAlignment();
  game.shoe = shuffle(buildShoe(NUM_DECKS));
  // Initialize cut card position
  game.cutCardPosition = 60 + Math.floor(Math.random() * 30);
  render();
});
