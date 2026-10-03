/**
 * BeatShake — Smooth Cam Shake & Bass Pulse (MusicVid.org style)
 * 
 * Поддерживает 2 режима работы:
 * 1. Web Audio API (при наличии доступа к потоку, например http://localhost:3000):
 *    Спектральный анализ частот бочки (35–130 Hz), Audio Smoothing (0.89),
 *    динамический порог и нелинейная огибающая.
 * 2. Hybrid Rhythm Engine (для file:// или при CORS-блокировке потока):
 *    Синхронизируется напрямую с currentTime играющего аудиоэлемента,
 *    генерируя ритмичные физические импульсы пружины под темп трека (BPM).
 *    Полностью обходит любые CORS-ограничения браузеров!
 * 
 * В обоих режимах используется единая физическая модель:
 * Critically Damped Harmonic Oscillator (пружинный амортизатор)
 * с мягким толчком вниз, легким наклоном и импульсом зума (Bass Pulse).
 */
class BeatShake {
  constructor(options = {}) {
    // Целевой элемент
    this.target = options.target || document.getElementById("camera-rig") || document.body;
    this.mediaElement = options.mediaElement || null;

    // MusicVid параметры
    this.intensity = typeof options.intensity === "number" ? options.intensity : 5;       // Position Shake в px
    this.rotation = typeof options.rotation === "number" ? options.rotation : 0.35;       // Rotation Amount в градусах
    this.scalePunch = typeof options.scale === "number" ? options.scale : 0.016;          // Bass Pulse (масштаб зума, база 1.6%)
    this.sensitivity = typeof options.sensitivity === "number" ? options.sensitivity : 0.60; // Reactivity threshold (0–1)
    this.audioSmoothing = typeof options.audioSmoothing === "number" ? options.audioSmoothing : 0.89; // Analyser smoothing
    this.bpm = typeof options.bpm === "number" ? options.bpm : 128;                       // BPM трека для file:// режима

    this.enabled = true;

    // Частотный диапазон удара бочки (35–130 Hz)
    this.freqLow = 35;
    this.freqHigh = 130;

    // Web Audio API
    this.analyser = null;
    this.dataArray = null;
    this.sampleRate = 44100;
    this._binLow = 1;
    this._binHigh = 3;

    // Реактивность и огибающая (Envelope Follower)
    this.envelope = 0;              // текущее значение огибающей (0–1)
    this.bassBaseline = 0.2;        // динамический средний уровень баса
    this.attackSpeed = 26.0;        // скорость нарастания (~35ms)
    this.releaseSpeed = 4.5;        // скорость затухания (~220ms)

    // Физическая модель пружины (Damped Spring)
    this.posX = 0;
    this.posY = 0;
    this.rot = 0;
    this.currentScale = 1.0;

    this.velX = 0;
    this.velY = 0;
    this.velRot = 0;
    this.wanderAngle = 0;
    // Серия последовательных ударов баса (3-hit combo)
    this.hitStreak = 0;             // счетчик серии ударов (1, 2, 3+)
    this.lastHitTime = 0;           // время предыдущего удара
    this.prevReactive = 0;          // предыдущее значение импульса

    // RequestAnimationFrame
    this._rafId = null;
    this._lastTime = 0;
    this._bound_tick = this._tick.bind(this);

    // Запускаем RAF цикл сразу
    this._startLoop();
  }

  setMediaElement(el) {
    this.mediaElement = el;
  }

  /**
   * Подключается к существующему AudioContext и ноде вывода (masterGain или sourceNode)
   */
  connectToContext(audioCtx, sourceOrMasterNode) {
    if (!audioCtx || !sourceOrMasterNode) return;

    try {
      this.sampleRate = audioCtx.sampleRate || 44100;

      this.analyser = audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = Math.max(0.1, Math.min(0.96, this.audioSmoothing));

      sourceOrMasterNode.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this._calcFreqBins();
    } catch (e) {
      console.warn("[BeatShake] Web Audio analyser connection failed:", e);
    }
  }

  _calcFreqBins() {
    if (!this.analyser) return;
    const binCount = this.analyser.frequencyBinCount;
    const nyquist = this.sampleRate / 2;
    const binWidth = nyquist / binCount;

    this._binLow = Math.max(1, Math.floor(this.freqLow / binWidth));
    this._binHigh = Math.max(this._binLow + 1, Math.ceil(this.freqHigh / binWidth));
  }

  _startLoop() {
    if (this._rafId) return;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._bound_tick);
  }

  _stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this.target) this.target.style.transform = "";
  }

  _tick(now) {
    this._rafId = requestAnimationFrame(this._bound_tick);

    const dt = Math.min((now - this._lastTime) / 1000, 0.04);
    this._lastTime = now;

    if (!this.enabled) {
      this._settleToRest(dt);
      return;
    }

    let reactiveImpulse = 0;
    let hasWebAudio = false;

    // ═══════════════════════════════════════════════════════════
    //  РЕЖИМ 1: WEB AUDIO API (РЕАЛЬНЫЙ АНАЛИЗ ЧАСТОТ 35–130 Hz)
    //  Работает при наличии доступа к аудиопотоку (http://localhost:3000)
    // ═══════════════════════════════════════════════════════════
    if (this.analyser && this.dataArray) {
      this.analyser.getByteFrequencyData(this.dataArray);

      let sum = 0;
      const count = this._binHigh - this._binLow + 1;
      for (let i = this._binLow; i <= this._binHigh; i++) {
        sum += this.dataArray[i];
      }

      // Если данные не нулевые (CORS не заблокировал сигнал)
      if (sum > 0) {
        hasWebAudio = true;
        const currentBassEnergy = sum / (count * 255);
        this.bassBaseline += (currentBassEnergy - this.bassBaseline) * (1.5 * dt);

        const sensitivityThreshold = (1.0 - this.sensitivity) * 0.75;
        const dynamicThreshold = Math.max(0.18, sensitivityThreshold + this.bassBaseline * 0.25);

        if (currentBassEnergy > dynamicThreshold) {
          const delta = (currentBassEnergy - dynamicThreshold) / (1.0 - Math.min(0.85, dynamicThreshold));
          reactiveImpulse = Math.pow(Math.max(0, Math.min(1.0, delta)), 2.2);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    //  РЕЖИМ 2: RHYTHM KICK ENGINE (ДЛЯ PROTOCOL FILE://)
    //  Когда Web Audio недоступен или обнулен CORS браузера,
    //  синхронизируется напрямую с currentTime играющего аудио!
    // ═══════════════════════════════════════════════════════════
    if (!hasWebAudio && this.mediaElement && !this.mediaElement.paused && this.mediaElement.currentTime > 0) {
      const beatPeriod = 60 / this.bpm; // длительность одной четверти бита в сек
      const t = this.mediaElement.currentTime;
      const beatPhase = (t % beatPeriod) / beatPeriod;

      // Резкий импульс на ударе бочки (phase 0) с мягким спадом
      const kickImpulse = Math.exp(-beatPhase * 14.0);
      if (kickImpulse > 0.03) {
        reactiveImpulse = Math.pow(kickImpulse, 2.0);
      }
    }

    // Если аудио на паузе или нет импульса
    if (reactiveImpulse <= 0 && (!this.mediaElement || this.mediaElement.paused)) {
      this._settleToRest(dt);
      return;
    }

    // ═══════════════════════════════════════════════════════════
    //  3. ОГИБАЮЩАЯ (Attack / Release)
    // ═══════════════════════════════════════════════════════════
    if (reactiveImpulse > this.envelope) {
      this.envelope += (reactiveImpulse - this.envelope) * (1 - Math.exp(-this.attackSpeed * dt));
    } else {
      this.envelope += (reactiveImpulse - this.envelope) * (1 - Math.exp(-this.releaseSpeed * dt));
    }
    this.envelope = Math.max(0, Math.min(1.0, this.envelope));

    // ═══════════════════════════════════════════════════════════
    //  ДЕТЕКЦИЯ СЕРИИ УДАРОВ БАСА (3-HIT BASS COMBO)
    //  При серии из 2–3 последовательных ударов бочки зум усиливается!
    // ═══════════════════════════════════════════════════════════
    const isHitOnset = (reactiveImpulse > 0.25) && (reactiveImpulse - this.prevReactive > 0.10);
    if (isHitOnset && (now - this.lastHitTime > 150)) {
      if (now - this.lastHitTime < 750) {
        this.hitStreak = Math.min(3, this.hitStreak + 1);
      } else {
        this.hitStreak = 1;
      }
      this.lastHitTime = now;
    } else if (now - this.lastHitTime > 900) {
      this.hitStreak = 0;
    }
    this.prevReactive = reactiveImpulse;

    // Множитель комбо ударов: 1 удар = 1.0x, 2 удара = 1.4x, 3+ удара = 1.9x (зум до ~3%)
    const streakScaleMult = 1.0 + (this.hitStreak >= 3 ? 0.9 : (this.hitStreak === 2 ? 0.4 : 0.0));
    const streakForceMult = 1.0 + (this.hitStreak >= 3 ? 0.25 : (this.hitStreak === 2 ? 0.12 : 0.0));

    // ═══════════════════════════════════════════════════════════
    //  4. ФИЗИЧЕСКИЙ ПРУЖИННЫЙ АМОРТИЗАТОР (Damped Spring)
    // ═══════════════════════════════════════════════════════════
    this.wanderAngle += 0.9 * dt;

    const forceY = this.envelope * this.intensity * 0.9 * streakForceMult;
    const forceX = Math.sin(this.wanderAngle) * this.envelope * this.intensity * 0.6 * streakForceMult;
    const forceRot = Math.cos(this.wanderAngle * 0.75) * this.envelope * this.rotation * streakForceMult;

    const k = 22.0;       // жесткость пружины
    const damping = 6.8;  // демпфирование

    const accX = -k * this.posX - damping * this.velX + forceX * 32;
    const accY = -k * this.posY - damping * this.velY + forceY * 32;
    const accRot = -k * this.rot - damping * this.velRot + forceRot * 32;

    this.velX += accX * dt;
    this.velY += accY * dt;
    this.velRot += accRot * dt;

    this.posX += this.velX * dt;
    this.posY += this.velY * dt;
    this.rot += this.velRot * dt;

    // Bass Pulse: импульс масштаба камеры под бочку (усиленный при серии ударов)
    const effectiveScalePunch = this.scalePunch * streakScaleMult;
    const targetScale = 1.0 + (this.envelope * effectiveScalePunch);
    this.currentScale += (targetScale - this.currentScale) * (1 - Math.exp(-14 * dt));

    // ═══════════════════════════════════════════════════════════
    //  5. ПРИМЕНЕНИЕ К КАМЕРЕ (GPU Compositor)
    // ═══════════════════════════════════════════════════════════
    this._applyTransform();
  }

  _settleToRest(dt) {
    this.envelope *= Math.exp(-this.releaseSpeed * dt);

    const k = 22.0;
    const damping = 6.8;

    this.velX += (-k * this.posX - damping * this.velX) * dt;
    this.velY += (-k * this.posY - damping * this.velY) * dt;
    this.velRot += (-k * this.rot - damping * this.velRot) * dt;

    this.posX += this.velX * dt;
    this.posY += this.velY * dt;
    this.rot += this.velRot * dt;
    this.currentScale += (1.0 - this.currentScale) * (1 - Math.exp(-10 * dt));

    this._applyTransform();
  }

  _applyTransform() {
    if (!this.target) return;

    const isMoving = Math.abs(this.posX) > 0.04 ||
                     Math.abs(this.posY) > 0.04 ||
                     Math.abs(this.rot) > 0.01 ||
                     Math.abs(this.currentScale - 1.0) > 0.0008;

    if (isMoving) {
      this.target.style.transform = `translate3d(${this.posX.toFixed(2)}px, ${this.posY.toFixed(2)}px, 0) rotate(${this.rot.toFixed(3)}deg) scale(${this.currentScale.toFixed(4)})`;
    } else {
      this.target.style.transform = "";
    }
  }

  toggle(enabled) {
    this.enabled = enabled;
    if (!enabled && this.target) {
      this.target.style.transform = "";
      this.posX = 0;
      this.posY = 0;
      this.rot = 0;
      this.currentScale = 1.0;
      this.velX = 0;
      this.velY = 0;
      this.velRot = 0;
      this.envelope = 0;
    }
  }

  disconnectAnalyser() {
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {}
      this.analyser = null;
    }
    this.dataArray = null;
  }

  destroy() {
    this._stopLoop();
    this.disconnectAnalyser();
    if (this.target) this.target.style.transform = "";
  }
}

window.BeatShake = BeatShake;
