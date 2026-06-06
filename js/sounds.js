// Sound effects, synthesized with the Web Audio API so there are no asset
// files to ship. Each effect first checks for an override sample in /audio
// (e.g. audio/card.mp3); if that file exists it is used instead of the synth,
// so real recordings can be dropped in later with zero code changes.
//
// Public API:  Sound.play(name[, delaySeconds]), Sound.preload(),
//              Sound.toggleMute() -> bool, Sound.isMuted() -> bool

var Sound = (function () {
	var MUTE_KEY = "blackjackMuted";
	var muted = localStorage.getItem(MUTE_KEY) === "1";
	var ctx = null;
	var masterGain = null;
	var buffers = {}; // name -> decoded AudioBuffer for any /audio overrides

	var OVERRIDES = {
		card: "audio/card.mp3",
		flip: "audio/flip.mp3",
		chip: "audio/chip.mp3",
		win: "audio/win.mp3",
		blackjack: "audio/blackjack.mp3",
		lose: "audio/lose.mp3",
		push: "audio/push.mp3",
		shuffle: "audio/shuffle.mp3"
	};

	function ac() {
		if (!ctx) {
			var AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) { return null; }
			ctx = new AC();
		}
		if (ctx.state === "suspended") { ctx.resume(); }
		return ctx;
	}

	function master(c) {
		if (!masterGain) {
			masterGain = c.createGain();
			masterGain.gain.value = 0.6;
			masterGain.connect(c.destination);
		}
		return masterGain;
	}

	// Gain envelope: quick attack to `peak`, exponential decay to silence.
	function env(g, t0, dur, peak, attack) {
		attack = attack || 0.005;
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
	}

	function tone(c, o) {
		var t0 = c.currentTime + (o.delay || 0);
		var osc = c.createOscillator();
		var g = c.createGain();
		osc.type = o.type || "sine";
		osc.frequency.setValueAtTime(o.freq, t0);
		if (o.slideTo) { osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + o.dur); }
		env(g, t0, o.dur, o.gain || 0.2, o.attack);
		osc.connect(g).connect(master(c));
		osc.start(t0);
		osc.stop(t0 + o.dur + 0.02);
	}

	function noise(c, o) {
		var t0 = c.currentTime + (o.delay || 0);
		var len = Math.ceil(c.sampleRate * o.dur);
		var buf = c.createBuffer(1, len, c.sampleRate);
		var data = buf.getChannelData(0);
		for (var i = 0; i < len; i++) { data[i] = Math.random() * 2 - 1; }
		var src = c.createBufferSource();
		src.buffer = buf;
		var filt = c.createBiquadFilter();
		filt.type = o.filterType || "bandpass";
		filt.frequency.setValueAtTime(o.filterFreq || 1500, t0);
		if (o.filterTo) { filt.frequency.exponentialRampToValueAtTime(o.filterTo, t0 + o.dur); }
		if (o.q) { filt.Q.value = o.q; }
		var g = c.createGain();
		env(g, t0, o.dur, o.gain || 0.3, o.attack || 0.002);
		src.connect(filt).connect(g).connect(master(c));
		src.start(t0);
		src.stop(t0 + o.dur + 0.02);
	}

	var SYNTH = {
		card: function (c) {
			noise(c, { dur: 0.09, filterType: "bandpass", filterFreq: 1800, q: 0.8, gain: 0.35 });
			tone(c, { freq: 180, type: "sine", dur: 0.06, gain: 0.12 }); // soft thud
		},
		flip: function (c) {
			noise(c, { dur: 0.16, filterType: "highpass", filterFreq: 600, filterTo: 3000, gain: 0.28 });
		},
		chip: function (c) {
			tone(c, { freq: 1400, type: "triangle", dur: 0.05, gain: 0.18 });
			tone(c, { freq: 1900, type: "triangle", dur: 0.06, gain: 0.14, delay: 0.05 });
		},
		win: function (c) {
			[523.25, 659.25, 783.99].forEach(function (f, i) {
				tone(c, { freq: f, type: "sine", dur: 0.25, gain: 0.22, delay: i * 0.08 });
			});
		},
		blackjack: function (c) {
			[523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
				tone(c, { freq: f, type: "triangle", dur: 0.3, gain: 0.22, delay: i * 0.09 });
			});
			[1568, 2093].forEach(function (f, i) {
				tone(c, { freq: f, type: "sine", dur: 0.18, gain: 0.1, delay: 0.36 + i * 0.06 });
			});
		},
		lose: function (c) {
			tone(c, { freq: 220, type: "sine", dur: 0.35, gain: 0.2, slideTo: 110 });
		},
		push: function (c) {
			tone(c, { freq: 440, type: "sine", dur: 0.15, gain: 0.15 });
		},
		shuffle: function (c) {
			for (var i = 0; i < 7; i++) {
				noise(c, { dur: 0.05, filterType: "bandpass", filterFreq: 2500, q: 1, gain: 0.18, delay: i * 0.05 });
			}
		}
	};

	function playBuffer(c, buf) {
		var src = c.createBufferSource();
		src.buffer = buf;
		var g = c.createGain();
		g.gain.value = 0.9;
		src.connect(g).connect(master(c));
		src.start();
	}

	function playNow(name) {
		var c = ac();
		if (!c) { return; }
		if (buffers[name]) { playBuffer(c, buffers[name]); return; }
		if (SYNTH[name]) { SYNTH[name](c); }
	}

	function play(name, delay) {
		if (muted) { return; }
		if (delay && delay > 0) {
			setTimeout(function () { playNow(name); }, delay * 1000);
		} else {
			playNow(name);
		}
	}

	// Attempt to load any override samples. Missing files (404 / file://) are
	// silently ignored and the synth is used instead.
	function preload() {
		var AC = window.AudioContext || window.webkitAudioContext;
		if (!AC || typeof fetch !== "function") { return; }
		Object.keys(OVERRIDES).forEach(function (name) {
			fetch(OVERRIDES[name])
				.then(function (r) { if (!r.ok) { throw 0; } return r.arrayBuffer(); })
				.then(function (data) { return ac().decodeAudioData(data); })
				.then(function (buf) { buffers[name] = buf; })
				.catch(function () { /* no override present */ });
		});
	}

	function toggleMute() {
		muted = !muted;
		localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
		return muted;
	}

	function isMuted() { return muted; }

	return { play: play, preload: preload, toggleMute: toggleMute, isMuted: isMuted };
})();
