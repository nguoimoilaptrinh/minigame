// Bộ máy âm thanh v2.0: Giọng đọc kép (Google Cloud TTS Tiếng Việt + Web Speech Fallback) & Web Audio SFX
window.AudioEngine = (() => {
  let ctx = null;
  let voiceEnabled = true;
  let sfxEnabled = true;
  let speechRate = 1.05;
  let ttsMode = 'cloud'; // 'cloud' | 'browser'
  let selectedVoiceURI = '';
  let voices = [];
  let currentSpeakToken = 0;
  let currentAudioEl = null;

  function ensureContext() {
    if (!ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function unlock() {
    ensureContext();
    if ('speechSynthesis' in window) {
      loadVoices();
    }
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) return [];
    const list = window.speechSynthesis.getVoices() || [];
    if (list.length > 0) {
      voices = list;
      if (!selectedVoiceURI) {
        const viVoice =
          list.find((v) => v.lang.toLowerCase().startsWith('vi') && v.name.toLowerCase().includes('natural')) ||
          list.find((v) => v.lang.toLowerCase().startsWith('vi') && v.name.toLowerCase().includes('online')) ||
          list.find((v) => v.lang.toLowerCase().startsWith('vi') && v.name.toLowerCase().includes('google')) ||
          list.find((v) => v.lang.toLowerCase().startsWith('vi')) ||
          list[0];
        if (viVoice) selectedVoiceURI = viVoice.voiceURI;
      }
    }
    return voices;
  }

  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      loadVoices();
      document.dispatchEvent(new CustomEvent('audio-voices-updated'));
    });
  }

  function getVoices() {
    if (!voices.length) loadVoices();
    return voices;
  }

  function setConfig({ voice, sfx, rate, voiceURI, mode }) {
    if (typeof voice === 'boolean') voiceEnabled = voice;
    if (typeof sfx === 'boolean') sfxEnabled = sfx;
    if (typeof rate === 'number') speechRate = Math.min(1.5, Math.max(0.7, rate));
    if (typeof voiceURI === 'string') selectedVoiceURI = voiceURI;
    if (mode === 'cloud' || mode === 'browser') ttsMode = mode;
  }

  function getConfig() {
    return {
      voice: voiceEnabled,
      sfx: sfxEnabled,
      rate: speechRate,
      voiceURI: selectedVoiceURI,
      mode: ttsMode
    };
  }

  function stopSpeech() {
    currentSpeakToken += 1;
    if (currentAudioEl) {
      try {
        currentAudioEl.pause();
        currentAudioEl.src = '';
      } catch (_) {}
      currentAudioEl = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {}
    }
  }

  // Chia câu thoại dài thành các mệnh đề <= 150 ký tự để đọc tự nhiên & khớp giới hạn TTS
  function splitIntoChunks(text, maxLen = 150) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    const sentences = clean.split(/(?<=[.!?;,])\s+/);
    const chunks = [];
    let current = '';

    for (const part of sentences) {
      if ((current + ' ' + part).trim().length <= maxLen) {
        current = (current + ' ' + part).trim();
      } else {
        if (current) chunks.push(current);
        if (part.length <= maxLen) {
          current = part;
        } else {
          // Cắt theo từ nếu một cụm vẫn quá dài
          const words = part.split(' ');
          let sub = '';
          for (const w of words) {
            if ((sub + ' ' + w).trim().length <= maxLen) {
              sub = (sub + ' ' + w).trim();
            } else {
              if (sub) chunks.push(sub);
              sub = w;
            }
          }
          current = sub;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  function speakWithWebSpeech(text, token, onDone) {
    if (token !== currentSpeakToken) return;
    if (!('speechSynthesis' in window)) {
      const readDelay = Math.min(2800, Math.max(1000, text.length * 42));
      setTimeout(() => {
        if (token === currentSpeakToken) onDone();
      }, readDelay);
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch (_) {}

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    utter.rate = speechRate;
    utter.pitch = 1.0;

    const available = getVoices();
    const chosen =
      available.find((v) => v.voiceURI === selectedVoiceURI) ||
      available.find((v) => v.lang.toLowerCase().startsWith('vi'));
    if (chosen) {
      utter.voice = chosen;
      utter.lang = chosen.lang;
    }

    let finished = false;
    const safeFinish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(guardTimer);
      if (token === currentSpeakToken) onDone();
    };

    const maxWaitMs = Math.max(3500, Math.min(14000, text.length * 110));
    const guardTimer = setTimeout(safeFinish, maxWaitMs);

    utter.onend = safeFinish;
    utter.onerror = safeFinish;

    try {
      window.speechSynthesis.speak(utter);
    } catch (_) {
      safeFinish();
    }
  }

  function playCloudChunks(chunks, index, token, onDone) {
    if (token !== currentSpeakToken) return;
    if (index >= chunks.length) {
      onDone();
      return;
    }

    const chunk = chunks[index];
    const ttsUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encodeURIComponent(chunk)}`;
    const audio = new Audio(ttsUrl);
    audio.referrerPolicy = 'no-referrer';
    audio.playbackRate = speechRate;
    currentAudioEl = audio;

    let handled = false;
    const guardMs = Math.max(4500, Math.min(12000, chunk.length * 120));
    const guardTimer = setTimeout(() => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      playCloudChunks(chunks, index + 1, token, onDone);
    }, guardMs);

    audio.onended = () => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      clearTimeout(guardTimer);
      currentAudioEl = null;
      // Nhịp nghỉ tự nhiên giữa các câu
      setTimeout(() => playCloudChunks(chunks, index + 1, token, onDone), 140);
    };

    audio.onerror = () => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      clearTimeout(guardTimer);
      currentAudioEl = null;
      // Tự động fallback sang Web Speech cho phần còn lại
      speakWithWebSpeech(chunks.slice(index).join(' '), token, onDone);
    };

    audio.play().catch(() => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      clearTimeout(guardTimer);
      currentAudioEl = null;
      speakWithWebSpeech(chunks.slice(index).join(' '), token, onDone);
    });
  }

  // Phát giọng nói Tiếng Việt (ưu tiên Cloud AI tự nhiên, tự fallback sang Web Speech)
  function speak(text, onEnd) {
    stopSpeech();
    const token = currentSpeakToken;
    const done = () => {
      if (token !== currentSpeakToken) return;
      if (typeof onEnd === 'function') onEnd();
    };

    if (!voiceEnabled || !text) {
      const readDelay = Math.min(2500, Math.max(900, (text || '').length * 40));
      setTimeout(done, readDelay);
      return;
    }

    if (ttsMode === 'cloud') {
      const chunks = splitIntoChunks(text, 150);
      if (chunks.length > 0) {
        playCloudChunks(chunks, 0, token, done);
        return;
      }
    }

    speakWithWebSpeech(text, token, done);
  }

  // ==================== HIỆU ỨNG ÂM THANH TỔNG HỢP (WEB AUDIO API) ====================
  function playTone(freq, duration, type = 'sine', volume = 0.2, delay = 0) {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + duration + 0.04);
  }

  function playWolfHowl() {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now);

    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.45);
    osc.frequency.exponentialRampToValueAtTime(360, now + 1.1);
    osc.frequency.exponentialRampToValueAtTime(190, now + 1.85);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 1.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 1.95);
  }

  function playRoosterDawn() {
    if (!sfxEnabled) return;
    playTone(523.25, 0.35, 'triangle', 0.22, 0);
    playTone(659.25, 0.35, 'triangle', 0.22, 0.14);
    playTone(783.99, 0.45, 'triangle', 0.24, 0.28);
    playTone(1046.5, 0.75, 'sine', 0.2, 0.44);
  }

  function playNightAmbience() {
    if (!sfxEnabled) return;
    playTone(220, 0.65, 'sine', 0.16, 0);
    playTone(196, 0.7, 'sine', 0.16, 0.25);
    playTone(146.83, 0.9, 'triangle', 0.14, 0.55);
  }

  function playHeartbeat() {
    if (!sfxEnabled) return;
    playTone(75, 0.16, 'sine', 0.32, 0);
    playTone(62, 0.2, 'sine', 0.26, 0.2);
  }

  function playWitchPotion() {
    if (!sfxEnabled) return;
    [440, 554, 659, 880].forEach((f, idx) => {
      playTone(f, 0.22, 'sine', 0.14, idx * 0.08);
    });
  }

  function playHunterShot() {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const bufferSize = ac.sampleRate * 0.35;
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.07));
    }
    const noise = ac.createBufferSource();
    noise.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.42, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.34);
    noise.connect(gain);
    gain.connect(ac.destination);
    noise.start();
  }

  function playVoteGavel() {
    if (!sfxEnabled) return;
    playTone(330, 0.12, 'square', 0.12, 0);
    playTone(220, 0.3, 'triangle', 0.2, 0.1);
  }

  function playVictory() {
    if (!sfxEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => playTone(n, 0.38, 'triangle', 0.2, i * 0.13));
  }

  function playTick() {
    if (!sfxEnabled) return;
    playTone(920, 0.05, 'sine', 0.08, 0);
  }

  return {
    unlock,
    getVoices,
    setConfig,
    getConfig,
    speak,
    stopSpeech,
    playWolfHowl,
    playNightAmbience,
    playRoosterDawn,
    playHeartbeat,
    playWitchPotion,
    playHunterShot,
    playVoteGavel,
    playVictory,
    playTick
  };
})();
