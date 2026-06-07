// Looping background music, cached locally so the ~1 MB file is downloaded
// only once. On first load the track is fetched and stored as a Blob in
// IndexedDB; every later visit reads it straight from that cache and plays
// from an object URL, so there is no network request after the first time.
//
// Browsers block audio autoplay until the user interacts with the page, so
// playback is armed to begin on the first click/keypress.
//
// This is intentionally independent of the Sound (sound-effects) module: it
// has its own mute state and its own toggle button.
//
// Public API:  Music.init(), Music.toggleMute() -> bool, Music.isMuted() -> bool

var Music = (function () {
  var MUTE_KEY = "blackjackMusicMuted";
  var SRC = "assets/music.mp3";
  var DB_NAME = "blackjack-audio";
  var STORE = "files";

  var muted = localStorage.getItem(MUTE_KEY) === "1";
  var audio = null;
  var armed = false; // a gesture listener is waiting to start playback

  // --- IndexedDB blob cache -------------------------------------------------
  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject();
        return;
      }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(STORE);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function idbGet(key) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
        r.onsuccess = function () {
          resolve(r.result);
        };
        r.onerror = function () {
          reject(r.error);
        };
      });
    });
  }

  function idbPut(key, val) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  // Resolve a playable URL: cached blob if present, otherwise fetch it once
  // and cache it. If anything fails (e.g. opened from file:// where fetch is
  // blocked), fall back to the raw path and let the browser handle it.
  function resolveSource() {
    return idbGet(SRC)
      .then(function (blob) {
        if (blob) {
          return URL.createObjectURL(blob);
        }
        return fetch(SRC)
          .then(function (r) {
            if (!r.ok) {
              throw 0;
            }
            return r.blob();
          })
          .then(function (b) {
            idbPut(SRC, b).catch(function () {});
            return URL.createObjectURL(b);
          });
      })
      .catch(function () {
        return SRC;
      });
  }

  function tryPlay() {
    if (!audio || muted) {
      return;
    }
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        /* blocked until a user gesture; armStart() will retry */
      });
    }
  }

  // Begin playback on the first user gesture (required by autoplay policies).
  function armStart() {
    if (armed) {
      return;
    }
    armed = true;
    function onGesture() {
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
      armed = false;
      tryPlay();
    }
    document.addEventListener("pointerdown", onGesture);
    document.addEventListener("keydown", onGesture);
  }

  function init() {
    resolveSource().then(function (url) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.35;
      audio.src = url;
      tryPlay(); // works if autoplay is permitted
      armStart(); // otherwise start on first interaction
    });
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (muted) {
      if (audio) {
        audio.pause();
      }
    } else if (audio) {
      tryPlay();
    } else {
      armStart();
    }
    return muted;
  }

  function isMuted() {
    return muted;
  }

  return { init: init, toggleMute: toggleMute, isMuted: isMuted };
})();
