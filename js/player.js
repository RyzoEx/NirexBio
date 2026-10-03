/**
 * Advanced Audio Player & Media Controller
 * Supports Audio Priority Scenarios (A, B, C)
 * + Playlist with Crossfade (auto-detect audio2.mp3, audio3.mp3 etc.)
 * + BeatShake integration (cam shake under the beat)
 */
class MediaManager {
  constructor(config) {
    this.config = config;
    this.currentScenarioKey = config.activeScenario || "scenarioA";

    // DOM Elements
    this.audioElement = document.getElementById("main-audio");
    this.audioElement2 = document.getElementById("main-audio-2");
    this.videoElement = document.getElementById("bg-video");
    this.bgImageElement = document.getElementById("bg-image");

    // Player Widget Elements
    this.playerCard = document.getElementById("player-widget");
    if (this.config.effects && this.config.effects.showPlayer === false) {
      if (this.playerCard) this.playerCard.style.display = "none";
    }
    this.playBtn = document.getElementById("player-play-btn");
    this.playIcon = document.getElementById("play-icon");
    this.pauseIcon = document.getElementById("pause-icon");
    this.prevBtn = document.getElementById("player-prev-btn");
    this.nextBtn = document.getElementById("player-next-btn");
    this.heartBtn = document.getElementById("player-heart-btn");
    this.loopBtn = document.getElementById("player-loop-btn");

    this.coverImg = document.getElementById("track-cover");
    this.coverWrapper = document.getElementById("track-cover-wrapper");
    this.titleEl = document.getElementById("track-title");
    this.artistContainer = document.getElementById("track-artists");

    this.progressBar = document.getElementById("progress-bar-fill");
    this.progressContainer = document.getElementById("player-progress-container");
    this.currentTimeEl = document.getElementById("time-current");
    this.durationTimeEl = document.getElementById("time-duration");
    this.visualizerEl = document.getElementById("player-visualizer");

    // Global Mute Toggle (top-left)
    this.globalMuteBtn = document.getElementById("global-mute-toggle");
    this.globalVolumeIcon = document.getElementById("global-volume-icon");
    this.globalMuteIcon = document.getElementById("global-mute-icon");
    this.volumeVisualizer = document.getElementById("global-volume-bars");

    // State
    this.isPlaying = false;
    this.isMuted = false;
    this.isLooping = true;
    this.isLiked = false;
    this.isDragging = false;
    this.activeSource = null; // 'audio' | 'video' | null

    // Playlist State
    this.playlist = [];
    this.currentTrackIndex = 0;
    this.crossfadeDuration = 2.5;
    this.isCrossfading = false;
    this._crossfadeRAF = null;
    this._activeAudio = this.audioElement;
    this._fadingAudio = this.audioElement2;

    // Web Audio API (lazy init — only after user gesture)
    this._audioCtx = null;
    this._gainNodeA = null;
    this._gainNodeB = null;
    this._sourceA = null;
    this._sourceB = null;
    this._webAudioReady = false;

    // BeatShake
    this.beatShake = null;

    this.init();
  }

  init() {
    this.bindEvents();
    // applyScenario НЕ вызывается здесь с autoPlay,
    // только подготавливает UI (без AudioContext)
    this._prepareScenario(this.currentScenarioKey);
  }

  // ═══════════════════════════════════════════════════════════
  //  PREPARE SCENARIO (без Web Audio, без autoplay)
  // ═══════════════════════════════════════════════════════════
  _prepareScenario(scenarioKey) {
    const scenario = this.config.scenarios[scenarioKey];
    if (!scenario) return;

    this.currentScenarioKey = scenarioKey;
    this.crossfadeDuration = scenario.crossfadeDuration || 2.5;

    let audioSrc = this._fixAudioPath(scenario.audioSrc);

    // Setup Background (без звука)
    if (scenario.bgType === "video" && scenario.bgSrc) {
      this.videoElement.src = scenario.bgSrc;
      this.videoElement.style.display = "block";
      this.bgImageElement.style.display = "none";
      this.videoElement.muted = true;
      this.videoElement.load();
    } else {
      this.videoElement.pause();
      this.videoElement.style.display = "none";
      this.bgImageElement.style.display = "block";
      if (scenario.bgSrc) {
        this.bgImageElement.style.backgroundImage = `url('${scenario.bgSrc}')`;
      }
    }

    // Подготовить аудио (без play, без AudioContext)
    if (audioSrc) {
      this.activeSource = "audio";
      this._activeAudio.src = audioSrc;
      if (this.videoElement) this.videoElement.muted = true;

      this.enablePlayer(true);
      const firstTrack = (scenario.playlist && scenario.playlist[0]) || scenario.track;
      this.updateTrackInfo(firstTrack);
      this.setPlayState(false);
    } else if (scenario.bgType === "video") {
      this.activeSource = "video";
      this.enablePlayer(true);
      this.updateTrackInfo(scenario.track || {
        title: "Video Embedded Audio",
        artists: [{ name: "Video Background Stream", url: "#" }],
        cover: "assets/album.jpg"
      });
      this.setPlayState(false);
    } else {
      this.activeSource = null;
      this.enablePlayer(false);
      this.updateTrackInfo(null);
      this.setPlayState(false);
    }

    this.updateGlobalMuteUI();
  }

  // ═══════════════════════════════════════════════════════════
  //  AUTO-DETECT PLAYLIST (audio2.mp3, audio3.mp3, ...)
  // ═══════════════════════════════════════════════════════════
  async _probeAudioFile(src) {
    return new Promise(resolve => {
      // На HTTP протоколе — быстрый HEAD запрос
      if (window.location.protocol !== "file:") {
        fetch(src, { method: "HEAD" })
          .then(res => resolve(res.ok))
          .catch(() => resolve(false));
        return;
      }

      // На file:// — проверка доступности через Audio элемент
      const audio = new Audio();
      let finished = false;
      const done = (exists) => {
        if (finished) return;
        finished = true;
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.src = "";
        resolve(exists);
      };

      const timer = setTimeout(() => done(false), 200);
      audio.onloadedmetadata = () => { clearTimeout(timer); done(true); };
      audio.onerror = () => { clearTimeout(timer); done(false); };
      audio.src = src;
    });
  }

  _shufflePlaylist(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  async _buildPlaylist(scenario) {
    const playlist = [];

    if (scenario.playlist && scenario.playlist.length > 0) {
      scenario.playlist.forEach(t => playlist.push({ ...t }));
    } else if (scenario.audioSrc) {
      const src = this._fixAudioPath(scenario.audioSrc);
      playlist.push({
        src: src,
        title: scenario.track ? scenario.track.title : "Track 1",
        artists: scenario.track ? scenario.track.artists : [{ name: "Unknown", url: "#" }],
        cover: scenario.track ? scenario.track.cover : "assets/album.jpg"
      });
    }

    // Автопоиск audio2.mp3, audio3.mp3, ... (работает на http:// и file://)
    const existingSrcs = new Set(playlist.map(t => t.src));
    for (let i = 2; i <= 20; i++) {
      const candidateSrc = `assets/audio${i}.mp3`;
      if (existingSrcs.has(candidateSrc)) continue;

      const exists = await this._probeAudioFile(candidateSrc);
      if (exists) {
        playlist.push({
          src: candidateSrc,
          title: `Track ${i}`,
          artists: [{ name: "Audio Track", url: "#" }],
          cover: scenario.track ? scenario.track.cover : "assets/album.jpg"
        });
        console.log(`[Playlist] Auto-detected: ${candidateSrc}`);
      } else {
        break;
      }
    }

    return playlist;
  }

  // ═══════════════════════════════════════════════════════════
  //  WEB AUDIO API SETUP (lazy — после user gesture)
  // ═══════════════════════════════════════════════════════════
  _initWebAudio() {
    if (this._webAudioReady) return true;

    // ВАЖНО: Chromium блокирует Web Audio API на протоколе file://
    // ("MediaElementAudioSource outputs zeroes due to CORS").
    // При открытии через file:// мы НЕ подключаем MediaElementSource,
    // чтобы звук играл напрямую через нативный HTML5 Audio без блокировки.
    if (window.location.protocol === "file:") {
      console.warn("[MediaManager] Открыто через file:// — браузер глушит Web Audio API (CORS). Звук переключен на нативный HTML5 Audio.");
      this._webAudioReady = false;
      return false;
    }

    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      this._gainNodeA = this._audioCtx.createGain();
      this._gainNodeB = this._audioCtx.createGain();
      this._masterGain = this._audioCtx.createGain();

      this._sourceA = this._audioCtx.createMediaElementSource(this.audioElement);
      this._sourceA.connect(this._gainNodeA);
      this._gainNodeA.connect(this._masterGain);

      this._sourceB = this._audioCtx.createMediaElementSource(this.audioElement2);
      this._sourceB.connect(this._gainNodeB);
      this._gainNodeB.connect(this._masterGain);

      this._masterGain.connect(this._audioCtx.destination);

      this._gainNodeA.gain.value = 1.0;
      this._gainNodeB.gain.value = 0.0;
      this._masterGain.gain.value = this.isMuted ? 0.0 : 1.0;

      this._webAudioReady = true;
      return true;
    } catch (e) {
      console.warn("[MediaManager] Web Audio API init failed:", e);
      this._webAudioReady = false;
      return false;
    }
  }

  _resumeAudioCtx() {
    if (this._audioCtx && this._audioCtx.state === "suspended") {
      this._audioCtx.resume().catch(() => {});
    }
  }

  _fixAudioPath(src) {
    if (src && typeof src === "string" && src.startsWith("audio/")) {
      return src.replace(/^audio\//, "assets/");
    }
    return src;
  }

  bindEvents() {
    // Play/Pause
    if (this.playBtn) {
      this.playBtn.addEventListener("click", () => this.togglePlay());
    }

    // Prev
    if (this.prevBtn) {
      this.prevBtn.addEventListener("click", () => {
        if (this.playlist.length > 1) {
          this.prevTrack();
        } else {
          this.seekTo(0);
          this.showToast("Track restarted");
        }
      });
    }

    // Next
    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", () => {
        if (this.playlist.length > 1) {
          this.nextTrack();
        } else {
          this.seekTo(0);
          this.showToast("Lo-fi continuous loop active");
        }
      });
    }

    // Favorite button
    if (this.heartBtn) {
      this.heartBtn.addEventListener("click", () => {
        this.isLiked = !this.isLiked;
        this.heartBtn.classList.toggle("liked", this.isLiked);
        this.showToast(this.isLiked ? "Saved to Favorites" : "Removed from Favorites");
      });
    }

    // Loop button
    if (this.loopBtn) {
      this.loopBtn.addEventListener("click", () => {
        this.isLooping = !this.isLooping;
        this.loopBtn.classList.toggle("active-loop", this.isLooping);
        if (this.videoElement) this.videoElement.loop = true;
        this.showToast(this.isLooping ? "Loop enabled" : "Loop disabled");
      });
    }

    // Global Mute Toggle
    if (this.globalMuteBtn) {
      this.globalMuteBtn.addEventListener("click", () => this.toggleGlobalMute());
    }

    // Progress Bar Scrubbing
    if (this.progressContainer) {
      this.progressContainer.addEventListener("mousedown", (e) => this.handleSeekStart(e));
      window.addEventListener("mousemove", (e) => this.handleSeekMove(e));
      window.addEventListener("mouseup", () => this.handleSeekEnd());

      this.progressContainer.addEventListener("touchstart", (e) => this.handleSeekStart(e.touches[0]), { passive: true });
      window.addEventListener("touchmove", (e) => {
        if (this.isDragging) this.handleSeekMove(e.touches[0]);
      }, { passive: true });
      window.addEventListener("touchend", () => this.handleSeekEnd());
    }

    // Audio Element Events
    [this.audioElement, this.audioElement2].forEach(el => {
      if (!el) return;

      el.addEventListener("timeupdate", () => {
        if (this.activeSource === "audio" && !this.isDragging && el === this._activeAudio) {
          this.updateProgress(el.currentTime, el.duration);
          this._checkCrossfadeTrigger(el);
        }
      });

      el.addEventListener("ended", () => {
        if (el === this._activeAudio && this.activeSource === "audio") {
          this._onTrackEnded();
        }
      });

      el.addEventListener("play", () => {
        if (this.activeSource === "audio" && el === this._activeAudio) this.setPlayState(true);
      });

      el.addEventListener("pause", () => {
        if (this.activeSource === "audio" && el === this._activeAudio && !this.isCrossfading) {
          this.setPlayState(false);
        }
      });
    });

    // Video Element Events
    if (this.videoElement) {
      this.videoElement.addEventListener("timeupdate", () => {
        if (this.activeSource === "video" && !this.isDragging) {
          this.updateProgress(this.videoElement.currentTime, this.videoElement.duration);
        }
      });

      this.videoElement.addEventListener("play", () => {
        if (this.activeSource === "video") this.setPlayState(true);
      });

      this.videoElement.addEventListener("pause", () => {
        if (this.activeSource === "video") this.setPlayState(false);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  APPLY SCENARIO (вызывается ПОСЛЕ user gesture)
  // ═══════════════════════════════════════════════════════════
  async applyScenario(scenarioKey, autoPlay = false) {
    const scenario = this.config.scenarios[scenarioKey];
    if (!scenario) return;

    this.currentScenarioKey = scenarioKey;
    this.crossfadeDuration = scenario.crossfadeDuration || 2.5;

    // Reset
    if (this.audioElement) { this.audioElement.pause(); this.audioElement.currentTime = 0; }
    if (this.audioElement2) { this.audioElement2.pause(); this.audioElement2.currentTime = 0; }

    let audioSrc = this._fixAudioPath(scenario.audioSrc);

    // Setup Background
    if (scenario.bgType === "video" && scenario.bgSrc) {
      this.videoElement.src = scenario.bgSrc;
      this.videoElement.style.display = "block";
      this.bgImageElement.style.display = "none";
      this.videoElement.muted = true;
      this.videoElement.load();
      this.videoElement.play().catch(() => {});
    } else {
      this.videoElement.pause();
      this.videoElement.style.display = "none";
      this.bgImageElement.style.display = "block";
      if (scenario.bgSrc) {
        this.bgImageElement.style.backgroundImage = `url('${scenario.bgSrc}')`;
      }
    }

    // AUDIO PRIORITY
    if (audioSrc) {
      this.activeSource = "audio";

      // Собрать плейлист
      this.playlist = await this._buildPlaylist(scenario);

      // Случайный первый трек (Random / Shuffle)
      const shouldRandomize = (this.config.effects && this.config.effects.randomFirstTrack !== false);
      if (shouldRandomize && this.playlist.length > 1) {
        this._shufflePlaylist(this.playlist);
      }
      this.currentTrackIndex = 0;

      const initialTrack = this.playlist[0] || scenario.track;

      // Всегда гарантированно назначаем активный элемент
      this._activeAudio = this.audioElement;
      this._fadingAudio = this.audioElement2;
      this._activeAudio.muted = this.isMuted;
      this._activeAudio.volume = 1.0;

      // Инициализировать Web Audio (только если не file://)
      const webAudioOk = this._initWebAudio();
      if (webAudioOk) {
        this._resumeAudioCtx();
        if (this._gainNodeA) this._gainNodeA.gain.value = 1.0;
        if (this._gainNodeB) this._gainNodeB.gain.value = 0.0;
      }

      this._activeAudio.src = initialTrack.src;
      if (this.videoElement) this.videoElement.muted = true;

      this.enablePlayer(true);
      this.updateTrackInfo(initialTrack);

      if (autoPlay) {
        this._activeAudio.play()
          .then(() => {
            this.setPlayState(true);
            this._initBeatShake();
          })
          .catch(e => {
            console.log("Autoplay blocked:", e);
            this.setPlayState(false);
          });
      } else {
        this.setPlayState(false);
      }

      if (this.playlist.length > 1) {
        this.showToast(`Playlist: ${this.playlist.length} tracks`);
      }
    }
    else if (scenario.bgType === "video" && !audioSrc) {
      this.activeSource = "video";
      this.playlist = [];
      if (this.videoElement) this.videoElement.muted = this.isMuted;

      this.enablePlayer(true);
      this.updateTrackInfo(scenario.track || {
        title: "Video Embedded Audio",
        artists: [{ name: "Video Background Stream", url: "#" }],
        cover: "assets/album.jpg"
      });

      if (autoPlay && !this.isMuted) {
        this.videoElement.play().catch(() => {});
        this.setPlayState(true);
      } else {
        this.setPlayState(!this.videoElement.paused);
      }
    }
    else {
      this.activeSource = null;
      this.playlist = [];
      if (this.videoElement) this.videoElement.muted = true;
      if (this.audioElement) this.audioElement.pause();

      this.enablePlayer(false);
      this.updateTrackInfo(null);
      this.setPlayState(false);
    }

    this.updateGlobalMuteUI();
  }

  // ═══════════════════════════════════════════════════════════
  //  CROSSFADE
  // ═══════════════════════════════════════════════════════════
  _checkCrossfadeTrigger(currentAudio) {
    if (this.isCrossfading || this.playlist.length <= 1) return;

    const remaining = currentAudio.duration - currentAudio.currentTime;
    if (isNaN(remaining)) return;

    if (remaining <= this.crossfadeDuration && remaining > 0.1) {
      this._startCrossfade();
    }
  }

  _startCrossfade() {
    if (this.isCrossfading) return;
    this.isCrossfading = true;

    const nextIndex = (this.currentTrackIndex + 1) % this.playlist.length;

    if (nextIndex === 0 && !this.isLooping) {
      this.isCrossfading = false;
      return;
    }

    const nextTrack = this.playlist[nextIndex];

    // Загрузить следующий трек
    this._fadingAudio.src = nextTrack.src;
    this._fadingAudio.load();

    if (this._webAudioReady) {
      // Web Audio crossfade (GainNode)
      const activeGain = (this._activeAudio === this.audioElement) ? this._gainNodeA : this._gainNodeB;
      const nextGain = (this._fadingAudio === this.audioElement) ? this._gainNodeA : this._gainNodeB;
      nextGain.gain.value = 0.0;

      const playNext = () => {
        this._fadingAudio.play().catch(() => {});
        this._animateCrossfade(activeGain, nextGain, this.crossfadeDuration, () => {
          this._finishCrossfade(nextIndex, nextTrack);
        });
      };

      if (this._fadingAudio.readyState >= 2) {
        playNext();
      } else {
        this._fadingAudio.addEventListener("canplay", playNext, { once: true });
      }
    } else {
      // Fallback: volume-based crossfade (без Web Audio API)
      this._fadingAudio.volume = 0;

      const playNext = () => {
        this._fadingAudio.play().catch(() => {});
        this._animateVolumeCrossfade(this._activeAudio, this._fadingAudio, this.crossfadeDuration, () => {
          this._finishCrossfade(nextIndex, nextTrack);
        });
      };

      if (this._fadingAudio.readyState >= 2) {
        playNext();
      } else {
        this._fadingAudio.addEventListener("canplay", playNext, { once: true });
      }
    }
  }

  _finishCrossfade(nextIndex, nextTrack) {
    this.isCrossfading = false;

    const oldActive = this._activeAudio;
    oldActive.pause();
    oldActive.currentTime = 0;

    // Swap references
    const temp = this._activeAudio;
    this._activeAudio = this._fadingAudio;
    this._fadingAudio = temp;

    this.currentTrackIndex = nextIndex;
    this.updateTrackInfo({
      title: nextTrack.title,
      artists: nextTrack.artists,
      cover: nextTrack.cover
    });

    this._reconnectBeatShake();
    this.showToast(`Now playing: ${nextTrack.title}`);
  }

  _animateCrossfade(fadeOutGain, fadeInGain, duration, onComplete) {
    const startTime = performance.now();
    const durationMs = duration * 1000;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

      fadeOutGain.gain.value = 1.0 - eased;
      fadeInGain.gain.value = eased;

      if (progress < 1.0) {
        this._crossfadeRAF = requestAnimationFrame(step);
      } else {
        fadeOutGain.gain.value = 0.0;
        fadeInGain.gain.value = 1.0;
        this._crossfadeRAF = null;
        if (onComplete) onComplete();
      }
    };

    this._crossfadeRAF = requestAnimationFrame(step);
  }

  /** Fallback crossfade через element.volume (без Web Audio) */
  _animateVolumeCrossfade(fadeOutEl, fadeInEl, duration, onComplete) {
    const startTime = performance.now();
    const durationMs = duration * 1000;

    const step = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1.0);
      const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

      fadeOutEl.volume = Math.max(0, 1.0 - eased);
      fadeInEl.volume = Math.min(1, eased);

      if (progress < 1.0) {
        this._crossfadeRAF = requestAnimationFrame(step);
      } else {
        fadeOutEl.volume = 0;
        fadeInEl.volume = 1;
        this._crossfadeRAF = null;
        if (onComplete) onComplete();
      }
    };

    this._crossfadeRAF = requestAnimationFrame(step);
  }

  _onTrackEnded() {
    if (this.playlist.length <= 1) {
      if (this.isLooping) {
        this._activeAudio.currentTime = 0;
        this._activeAudio.play().catch(() => {});
      } else {
        this.setPlayState(false);
      }
      return;
    }

    const nextIndex = (this.currentTrackIndex + 1) % this.playlist.length;

    if (nextIndex === 0 && !this.isLooping) {
      this.setPlayState(false);
      this.showToast("Playlist finished");
      return;
    }

    this.currentTrackIndex = nextIndex;
    const nextTrack = this.playlist[nextIndex];

    this._activeAudio.src = nextTrack.src;
    this._activeAudio.load();

    const playIt = () => {
      this._activeAudio.play().then(() => {
        this.setPlayState(true);
        this.updateTrackInfo({
          title: nextTrack.title,
          artists: nextTrack.artists,
          cover: nextTrack.cover
        });
        this.showToast(`Now playing: ${nextTrack.title}`);
      }).catch(() => {});
    };

    if (this._activeAudio.readyState >= 2) {
      playIt();
    } else {
      this._activeAudio.addEventListener("canplay", playIt, { once: true });
    }
  }

  nextTrack() {
    if (this.playlist.length <= 1) return;
    if (this._crossfadeRAF) { cancelAnimationFrame(this._crossfadeRAF); this._crossfadeRAF = null; }
    this.isCrossfading = false;
    this._switchToTrack((this.currentTrackIndex + 1) % this.playlist.length);
  }

  prevTrack() {
    if (this.playlist.length <= 1) return;
    if (this._activeAudio && this._activeAudio.currentTime > 3) {
      this._activeAudio.currentTime = 0;
      this.showToast("Track restarted");
      return;
    }
    if (this._crossfadeRAF) { cancelAnimationFrame(this._crossfadeRAF); this._crossfadeRAF = null; }
    this.isCrossfading = false;
    this._switchToTrack((this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length);
  }

  _switchToTrack(index) {
    const track = this.playlist[index];
    if (!track) return;

    // Быстрый fade out текущего
    const oldAudio = this._activeAudio;
    const fadeDuration = 300;

    if (this._webAudioReady) {
      const activeGain = (oldAudio === this.audioElement) ? this._gainNodeA : this._gainNodeB;
      activeGain.gain.setTargetAtTime(0, this._audioCtx.currentTime, 0.08);
    } else {
      // Volume fallback
      oldAudio.volume = 0;
    }

    setTimeout(() => {
      oldAudio.pause();
      oldAudio.currentTime = 0;

      this._fadingAudio.src = track.src;
      this._fadingAudio.load();

      const playIt = () => {
        if (this._webAudioReady) {
          const nextGain = (this._fadingAudio === this.audioElement) ? this._gainNodeA : this._gainNodeB;
          nextGain.gain.value = 0;
          nextGain.gain.setTargetAtTime(1, this._audioCtx.currentTime, 0.08);
        } else {
          this._fadingAudio.volume = 1;
        }

        this._fadingAudio.play().then(() => {
          const temp = this._activeAudio;
          this._activeAudio = this._fadingAudio;
          this._fadingAudio = temp;

          this.currentTrackIndex = index;
          this.setPlayState(true);
          this.updateTrackInfo({ title: track.title, artists: track.artists, cover: track.cover });
          this._reconnectBeatShake();
          this.showToast(`Now playing: ${track.title}`);
        }).catch(() => {});
      };

      if (this._fadingAudio.readyState >= 2) {
        playIt();
      } else {
        this._fadingAudio.addEventListener("canplay", playIt, { once: true });
      }
    }, fadeDuration);
  }

  // ═══════════════════════════════════════════════════════════
  //  BEATSHAKE (MusicVid.org style)
  // ═══════════════════════════════════════════════════════════
  _initBeatShake() {
    const effects = this.config.effects;
    if (!effects || !effects.makeCamShake) return;
    if (typeof BeatShake === "undefined") return;
    if (this.beatShake) return; // уже инициализирован

    const targetEl = document.getElementById("camera-rig") || document.body;
    const activeMedia = this._activeAudio || this.audioElement;

    this.beatShake = new BeatShake({
      target: targetEl,
      mediaElement: activeMedia,
      intensity: typeof effects.camShakeIntensity === "number" ? effects.camShakeIntensity : 5,
      rotation: typeof effects.camShakeRotation === "number" ? effects.camShakeRotation : 0.35,
      scale: typeof effects.camShakeScale === "number" ? effects.camShakeScale : 0.012,
      sensitivity: typeof effects.camShakeSensitivity === "number" ? effects.camShakeSensitivity : 0.60,
      audioSmoothing: typeof effects.camShakeSmoothing === "number" ? effects.camShakeSmoothing : 0.89,
      bpm: typeof effects.camShakeBpm === "number" ? effects.camShakeBpm : 128
    });

    // Подключиться к MasterGain (если Web Audio активен на http://)
    if (this._webAudioReady && this._masterGain) {
      this.beatShake.connectToContext(this._audioCtx, this._masterGain);
    } else if (this._webAudioReady && this._sourceA) {
      this.beatShake.connectToContext(this._audioCtx, this._sourceA);
    }
  }

  _reconnectBeatShake() {
    if (!this.beatShake) return;

    // Передаем новый активный аудио-элемент (audio2, audio3 и т.д.) для file:// режима
    this.beatShake.setMediaElement(this._activeAudio);

    if (this._webAudioReady && this._masterGain) {
      // В Web Audio режиме MasterGain автоматически микширует оба трека без разрывов
      return;
    }
    this.beatShake.disconnectAnalyser();
    if (this._webAudioReady) {
      const activeSource = (this._activeAudio === this.audioElement) ? this._sourceA : this._sourceB;
      if (activeSource) {
        this.beatShake.connectToContext(this._audioCtx, activeSource);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  UI & CONTROLS
  // ═══════════════════════════════════════════════════════════
  updateTrackInfo(track) {
    if (!track) {
      if (this.titleEl) this.titleEl.textContent = "No Audio Playing";
      if (this.artistContainer) this.artistContainer.innerHTML = '<span class="artist-muted">Idle / Standby Mode</span>';
      if (this.coverImg) this.coverImg.src = "assets/album.jpg";
      if (this.coverWrapper) this.coverWrapper.classList.add("cover-inactive");
      if (this.currentTimeEl) this.currentTimeEl.textContent = "--:--";
      if (this.durationTimeEl) this.durationTimeEl.textContent = "--:--";
      if (this.progressBar) this.progressBar.style.width = "0%";
      return;
    }

    if (this.coverWrapper) this.coverWrapper.classList.remove("cover-inactive");
    if (this.titleEl) this.titleEl.textContent = track.title;
    if (track.cover && this.coverImg) this.coverImg.src = track.cover;

    if (this.artistContainer) {
      this.artistContainer.innerHTML = "";
      if (Array.isArray(track.artists)) {
        track.artists.forEach((artist, idx) => {
          const link = document.createElement("a");
          link.className = "track-artist-link";
          link.href = artist.url || "#";
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = artist.name;
          this.artistContainer.appendChild(link);

          if (idx < track.artists.length - 1) {
            const sep = document.createElement("span");
            sep.className = "artist-sep";
            sep.textContent = ", ";
            this.artistContainer.appendChild(sep);
          }
        });
      }
    }
  }

  enablePlayer(enabled) {
    // Уважаем showPlayer: false
    if (this.config.effects && this.config.effects.showPlayer === false) {
      if (this.playerCard) this.playerCard.style.display = "none";
      return;
    }

    if (enabled) {
      if (this.playerCard) this.playerCard.classList.remove("player-disabled");
      if (this.playBtn) this.playBtn.disabled = false;
      if (this.progressContainer) {
        this.progressContainer.style.pointerEvents = "auto";
        this.progressContainer.style.opacity = "1";
      }
    } else {
      if (this.playerCard) this.playerCard.classList.add("player-disabled");
      if (this.playBtn) this.playBtn.disabled = true;
      if (this.progressContainer) {
        this.progressContainer.style.pointerEvents = "none";
        this.progressContainer.style.opacity = "0.4";
      }
    }
  }

  togglePlay() {
    if (this.activeSource === "audio") {
      if (this.videoElement) this.videoElement.muted = true;
      this._resumeAudioCtx();

      if (this._activeAudio.paused) {
        this._activeAudio.play().then(() => {
          this.setPlayState(true);
          if (!this.beatShake) this._initBeatShake();
        }).catch(err => console.log(err));
      } else {
        this._activeAudio.pause();
        this.setPlayState(false);
      }
    } else if (this.activeSource === "video") {
      if (this.videoElement.paused) {
        this.videoElement.play().then(() => this.setPlayState(true)).catch(err => console.log(err));
      } else {
        this.videoElement.pause();
        this.setPlayState(false);
      }
    }
  }

  setPlayState(playing) {
    this.isPlaying = playing;
    if (this.beatShake) {
      this.beatShake.toggle(playing);
      if (this._activeAudio) this.beatShake.setMediaElement(this._activeAudio);
    }
    if (playing) {
      if (this.playIcon) this.playIcon.style.display = "none";
      if (this.pauseIcon) this.pauseIcon.style.display = "block";
      if (this.coverWrapper) this.coverWrapper.classList.add("playing-pulse");
      if (this.visualizerEl) this.visualizerEl.classList.add("visualizer-active");
      if (this.volumeVisualizer) this.volumeVisualizer.classList.add("bars-active");
    } else {
      if (this.playIcon) this.playIcon.style.display = "block";
      if (this.pauseIcon) this.pauseIcon.style.display = "none";
      if (this.coverWrapper) this.coverWrapper.classList.remove("playing-pulse");
      if (this.visualizerEl) this.visualizerEl.classList.remove("visualizer-active");
      if (this.volumeVisualizer) this.volumeVisualizer.classList.remove("bars-active");
    }
  }

  toggleGlobalMute() {
    this.isMuted = !this.isMuted;

    if (this.activeSource === "audio") {
      if (this._webAudioReady && this._masterGain) {
        this._masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this._audioCtx.currentTime, 0.05);
      } else if (this._webAudioReady) {
        const activeGain = (this._activeAudio === this.audioElement) ? this._gainNodeA : this._gainNodeB;
        activeGain.gain.setTargetAtTime(this.isMuted ? 0 : 1, this._audioCtx.currentTime, 0.05);
      } else if (this._activeAudio) {
        this._activeAudio.muted = this.isMuted;
      }
      if (this.videoElement) this.videoElement.muted = true;
    } else if (this.activeSource === "video" && this.videoElement) {
      this.videoElement.muted = this.isMuted;
    }

    this.updateGlobalMuteUI();
    this.showToast(this.isMuted ? "Sound Muted" : "Sound Unmuted");
  }

  updateGlobalMuteUI() {
    if (this.isMuted) {
      if (this.globalVolumeIcon) this.globalVolumeIcon.style.display = "none";
      if (this.globalMuteIcon) this.globalMuteIcon.style.display = "block";
      if (this.globalMuteBtn) this.globalMuteBtn.classList.add("muted-state");
      if (this.volumeVisualizer) this.volumeVisualizer.classList.remove("bars-active");
    } else {
      if (this.globalVolumeIcon) this.globalVolumeIcon.style.display = "block";
      if (this.globalMuteIcon) this.globalMuteIcon.style.display = "none";
      if (this.globalMuteBtn) this.globalMuteBtn.classList.remove("muted-state");
      if (this.isPlaying && this.volumeVisualizer) {
        this.volumeVisualizer.classList.add("bars-active");
      }
    }
  }

  handleSeekStart(e) {
    if (!this.activeSource) return;
    this.isDragging = true;
    this.handleSeekMove(e);
  }

  handleSeekMove(e) {
    if (!this.isDragging || !this.activeSource) return;
    const rect = this.progressContainer.getBoundingClientRect();
    const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    this.progressBar.style.width = `${percent * 100}%`;

    const targetMedia = this.activeSource === "audio" ? this._activeAudio : this.videoElement;
    if (targetMedia && targetMedia.duration) {
      this.currentTimeEl.textContent = this.formatTime(percent * targetMedia.duration);
    }
  }

  handleSeekEnd() {
    if (!this.isDragging || !this.activeSource) return;
    this.isDragging = false;
    const percent = parseFloat(this.progressBar.style.width) / 100;
    const targetMedia = this.activeSource === "audio" ? this._activeAudio : this.videoElement;
    if (targetMedia && targetMedia.duration) {
      targetMedia.currentTime = percent * targetMedia.duration;
    }
  }

  seekTo(seconds) {
    const targetMedia = this.activeSource === "audio" ? this._activeAudio : this.videoElement;
    if (targetMedia) {
      targetMedia.currentTime = seconds;
      if (this.isPlaying) targetMedia.play().catch(() => {});
    }
  }

  updateProgress(currentTime, duration) {
    if (!duration || isNaN(duration)) return;
    const percent = (currentTime / duration) * 100;
    if (this.progressBar) this.progressBar.style.width = `${percent}%`;
    if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(currentTime);
    if (this.durationTimeEl) this.durationTimeEl.textContent = this.formatTime(duration);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  showToast(message) {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("toast-show");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove("toast-show");
    }, 2200);
  }
}

window.MediaManager = MediaManager;
