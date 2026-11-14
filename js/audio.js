// Bộ máy âm thanh v2.5: Khóa 100% Tiếng Việt (loại bỏ triệt để giọng Tiếng Anh) + Đổi nhanh Giọng Nữ / Giọng Nam
window.AudioEngine = (() => {
  const STORAGE_KEYS = {
    voice: 'hq_voice_enable',
    sfx: 'hq_sfx_enable',
    rate: 'hq_voice_rate',
    pitch: 'hq_voice_pitch',
    mode: 'hq_tts_mode',
    gender: 'hq_voice_gender',
    voiceURI: 'hq_voice_uri'
  };

  function readStorage(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const val = localStorage.getItem(key);
      return val === null ? fallback : val;
    } catch (_) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, String(value));
    } catch (_) {}
  }

  function clampNumber(val, min, max, fallback) {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function dispatchEventSafe(name, detail) {
    if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
      document.dispatchEvent(new CustomEvent(name, { detail }));
    }
  }

  let ctx = null;
  let voiceEnabled = readStorage(STORAGE_KEYS.voice, 'true') !== 'false';
  let sfxEnabled = readStorage(STORAGE_KEYS.sfx, 'true') !== 'false';
  let speechRate = clampNumber(readStorage(STORAGE_KEYS.rate, '1.02'), 0.7, 1.5, 1.02);
  let speechPitch = clampNumber(readStorage(STORAGE_KEYS.pitch, '1.0'), 0.7, 1.3, 1.0);
  const savedMode = readStorage(STORAGE_KEYS.mode, 'auto_neural');
  let ttsMode = savedMode === 'cloud' || savedMode === 'browser' ? savedMode : 'auto_neural';
  let voiceGender = readStorage(STORAGE_KEYS.gender, 'female') === 'male' ? 'male' : 'female';
  let selectedVoiceURI = readStorage(STORAGE_KEYS.voiceURI, '') || '';
  let voices = [];
  let currentSpeakToken = 0;
  let currentAudioEl = null;
  let isSpeakingState = false;

  function emitSpeakState(speaking) {
    if (isSpeakingState === speaking) return;
    isSpeakingState = speaking;
    dispatchEventSafe('audio-speak-state', { speaking });
  }

  function emitConfigChanged() {
    dispatchEventSafe('audio-config-changed', getConfig());
  }

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

  // Lọc nghiêm ngặt: CHỈ nhận giọng Tiếng Việt (tuyệt đối không nhận Microsoft David/Zira hay en-*)
  function isVietnameseVoice(v) {
    if (!v) return false;
    const lang = String(v.lang || '').trim().toLowerCase();
    const name = String(v.name || '').trim().toLowerCase();
    return (
      lang === 'vi' ||
      lang.startsWith('vi-') ||
      lang.startsWith('vi_') ||
      name.includes('vietnam') ||
      name.includes('tiếng việt') ||
      name.includes('tieng viet') ||
      name.includes('hoaimy') ||
      name.includes('namminh')
    );
  }

  function detectVietnameseVoiceGender(voice) {
    if (!voice) return 'female';
    const text = `${voice.name || ''} ${voice.voiceURI || ''}`.toLowerCase();
    if (
      /namminh|nam minh|microsoft an\b|\ban\s*-?\s*vietnam|vi-vn-x-vid|vi-vn-x-vic|(?:standard|wavenet|neural2)-[bd]\b|\bmale\b|\bgiọng nam\b/.test(
        text
      )
    ) {
      return 'male';
    }
    return 'female';
  }

  function getVoiceQualityScore(v) {
    const name = String(v?.name || '').toLowerCase();
    if (/hoaimy.*natural|namminh.*natural/.test(name)) return 5;
    if (/natural|neural/.test(name)) return 4;
    if (/online/.test(name)) return 3;
    if (/google/.test(name)) return 2;
    return 1;
  }

  function findVietnameseVoiceByGender(list, gender) {
    const viList = (list || []).filter(isVietnameseVoice);
    if (!viList.length) return null;
    const matched = viList
      .filter((v) => detectVietnameseVoiceGender(v) === gender)
      .sort((a, b) => getVoiceQualityScore(b) - getVoiceQualityScore(a));
    return matched[0] || null;
  }

  function findAutoWebSpeechVoice(list, gender) {
    const candidate = findVietnameseVoiceByGender(list, gender);
    if (!candidate) return null;
    const score = getVoiceQualityScore(candidate);
    if (score >= 3 || (gender === 'male' && detectVietnameseVoiceGender(candidate) === 'male')) {
      return candidate;
    }
    return null;
  }

  function loadVoices() {
    if (!('speechSynthesis' in window)) {
      voices = [];
      selectedVoiceURI = '';
      return voices;
    }
    const rawList = window.speechSynthesis.getVoices() || [];
    const viList = rawList.filter(isVietnameseVoice);
    voices = viList;

    // Xóa sạch nếu URI đang lưu không phải giọng Tiếng Việt hợp lệ (tránh kẹt Microsoft David/en-US)
    const savedStillValid = selectedVoiceURI && viList.some((v) => v.voiceURI === selectedVoiceURI);
    if (!savedStillValid) {
      selectedVoiceURI = '';
    }

    if (!selectedVoiceURI && viList.length > 0) {
      const preferred = findVietnameseVoiceByGender(viList, voiceGender) || viList[0];
      selectedVoiceURI = preferred ? preferred.voiceURI : '';
    }

    if (!viList.length) {
      selectedVoiceURI = '';
    }
    writeStorage(STORAGE_KEYS.voiceURI, selectedVoiceURI);
    return voices;
  }

  if ('speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', () => {
      loadVoices();
      dispatchEventSafe('audio-voices-updated');
    });
  }

  // Luôn chỉ trả về các giọng Tiếng Việt đã lọc
  function getVoices() {
    return loadVoices();
  }

  function setVoiceGender(gender) {
    const nextGender = gender === 'male' ? 'male' : 'female';
    voiceGender = nextGender;
    writeStorage(STORAGE_KEYS.gender, nextGender);

    const viList = getVoices();
    const matched = findVietnameseVoiceByGender(viList, nextGender);
    selectedVoiceURI = matched ? matched.voiceURI : '';
    writeStorage(STORAGE_KEYS.voiceURI, selectedVoiceURI);

    emitConfigChanged();
    dispatchEventSafe('audio-voices-updated');
    return getConfig();
  }

  function toggleVoiceGender() {
    return setVoiceGender(voiceGender === 'male' ? 'female' : 'male');
  }

  function setConfig({ voice, sfx, rate, pitch, voiceURI, mode, gender }) {
    if (typeof voice === 'boolean') {
      voiceEnabled = voice;
      writeStorage(STORAGE_KEYS.voice, voiceEnabled);
    }
    if (typeof sfx === 'boolean') {
      sfxEnabled = sfx;
      writeStorage(STORAGE_KEYS.sfx, sfxEnabled);
    }
    if (typeof rate === 'number') {
      speechRate = clampNumber(rate, 0.7, 1.5, speechRate);
      writeStorage(STORAGE_KEYS.rate, speechRate);
    }
    if (typeof pitch === 'number') {
      speechPitch = clampNumber(pitch, 0.7, 1.3, speechPitch);
      writeStorage(STORAGE_KEYS.pitch, speechPitch);
    }
    if (mode === 'auto_neural' || mode === 'cloud' || mode === 'browser') {
      ttsMode = mode;
      writeStorage(STORAGE_KEYS.mode, ttsMode);
    }
    if (gender === 'female' || gender === 'male') {
      voiceGender = gender;
      writeStorage(STORAGE_KEYS.gender, voiceGender);
    }
    if (typeof voiceURI === 'string') {
      if (!voiceURI) {
        selectedVoiceURI = '';
      } else {
        const viList = getVoices();
        const valid = viList.find((v) => v.voiceURI === voiceURI);
        selectedVoiceURI = valid ? valid.voiceURI : '';
      }
      writeStorage(STORAGE_KEYS.voiceURI, selectedVoiceURI);
    }
    emitConfigChanged();
  }

  function getConfig() {
    const viList = getVoices();
    return {
      voice: voiceEnabled,
      sfx: sfxEnabled,
      rate: speechRate,
      pitch: speechPitch,
      voiceURI: selectedVoiceURI,
      mode: ttsMode,
      gender: voiceGender,
      hasVietnameseVoice: viList.length > 0,
      hasNeuralVoice: Boolean(findAutoWebSpeechVoice(viList, voiceGender))
    };
  }

  function stopSpeech() {
    currentSpeakToken += 1;
    emitSpeakState(false);
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

  function speakWithWebSpeech(text, token, onDone, skipCloudFallback = false) {
    if (token !== currentSpeakToken) return;
    const available = getVoices();
    const chosen =
      available.find((v) => v.voiceURI === selectedVoiceURI && isVietnameseVoice(v)) ||
      findVietnameseVoiceByGender(available, voiceGender) ||
      available.find(isVietnameseVoice) ||
      null;

    // CHỐT AN TOÀN: Nếu không có giọng Tiếng Việt thực thụ, TUYỆT ĐỐI KHÔNG gọi speechSynthesis (tránh đọc giọng Anh)
    if (!('speechSynthesis' in window) || !chosen || !isVietnameseVoice(chosen)) {
      if (!skipCloudFallback) {
        const chunks = splitIntoChunks(text, 150);
        if (chunks.length > 0) {
          playCloudChunks(chunks, 0, token, onDone, 0);
          return;
        }
      }
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
    utter.voice = chosen;
    utter.lang = chosen.lang || 'vi-VN';

    // Nếu máy chỉ có 1 giọng Việt (ví dụ chỉ có giọng Nữ mà chọn Nam), điều chỉnh pitch trầm xuống
    const nativeGender = detectVietnameseVoiceGender(chosen);
    let finalPitch = speechPitch;
    let finalRate = speechRate;
    if (voiceGender === 'male' && nativeGender !== 'male') {
      finalPitch = clampNumber(0.68 * speechPitch, 0.5, 1.0, 0.68);
      finalRate = clampNumber(0.95 * speechRate, 0.7, 1.35, 0.95);
    } else if (voiceGender === 'female' && nativeGender === 'male') {
      finalPitch = clampNumber(1.32 * speechPitch, 1.05, 1.5, 1.32);
    }
    utter.pitch = finalPitch;
    utter.rate = finalRate;

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

  function applyCloudVoiceProfile(audio) {
    const isMale = voiceGender === 'male';
    const preserve = !isMale;
    if ('preservesPitch' in audio) audio.preservesPitch = preserve;
    if ('mozPreservesPitch' in audio) audio.mozPreservesPitch = preserve;
    if ('webkitPreservesPitch' in audio) audio.webkitPreservesPitch = preserve;
    audio.playbackRate = isMale
      ? clampNumber(0.83 * speechRate, 0.74, 0.92, 0.83)
      : clampNumber(speechRate, 0.75, 1.4, 1.02);
  }

  function buildCloudUrls(chunk) {
    const q = encodeURIComponent(chunk);
    return [
      `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${q}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${q}`
    ];
  }

  function playCloudChunks(chunks, index, token, onDone, mirrorIndex = 0) {
    if (token !== currentSpeakToken) return;
    if (index >= chunks.length) {
      onDone();
      return;
    }

    const chunk = chunks[index];
    const urls = buildCloudUrls(chunk);
    const ttsUrl = urls[mirrorIndex] || urls[0];
    const audio = new Audio(ttsUrl);
    if ('referrerPolicy' in audio) {
      audio.referrerPolicy = 'no-referrer';
    }
    applyCloudVoiceProfile(audio);
    if (typeof audio.addEventListener === 'function') {
      audio.addEventListener('loadedmetadata', () => applyCloudVoiceProfile(audio), { once: true });
    }
    currentAudioEl = audio;

    let handled = false;
    const guardMs = Math.max(4500, Math.min(12000, chunk.length * 130));
    const guardTimer = setTimeout(() => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      playCloudChunks(chunks, index + 1, token, onDone, 0);
    }, guardMs);

    const handleFailure = () => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      clearTimeout(guardTimer);
      currentAudioEl = null;
      if (mirrorIndex + 1 < urls.length) {
        playCloudChunks(chunks, index, token, onDone, mirrorIndex + 1);
      } else {
        speakWithWebSpeech(chunks.slice(index).join(' '), token, onDone, true);
      }
    };

    audio.onended = () => {
      if (handled || token !== currentSpeakToken) return;
      handled = true;
      clearTimeout(guardTimer);
      currentAudioEl = null;
      // Nhịp nghỉ kể chuyện tự nhiên giữa các câu
      setTimeout(() => playCloudChunks(chunks, index + 1, token, onDone, 0), 180);
    };

    audio.onerror = handleFailure;

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(handleFailure);
      }
    } catch (_) {
      handleFailure();
    }
  }

  // Phát giọng nói 100% Tiếng Việt (hỗ trợ Giọng Nữ / Giọng Nam)
  function speak(text, onEnd) {
    stopSpeech();
    const token = currentSpeakToken;
    const done = () => {
      if (token !== currentSpeakToken) return;
      emitSpeakState(false);
      if (typeof onEnd === 'function') onEnd();
    };

    if (!voiceEnabled || !text) {
      const readDelay = Math.min(2500, Math.max(900, (text || '').length * 40));
      setTimeout(done, readDelay);
      return;
    }

    emitSpeakState(true);
    const availableVoices = getVoices();

    if (ttsMode === 'auto_neural') {
      const autoViVoice = findAutoWebSpeechVoice(availableVoices, voiceGender);
      if (autoViVoice) {
        speakWithWebSpeech(text, token, done, false);
        return;
      }
      const chunks = splitIntoChunks(text, 150);
      if (chunks.length > 0) {
        playCloudChunks(chunks, 0, token, done, 0);
        return;
      }
    }

    if (ttsMode === 'cloud') {
      const chunks = splitIntoChunks(text, 150);
      if (chunks.length > 0) {
        playCloudChunks(chunks, 0, token, done, 0);
        return;
      }
    }

    speakWithWebSpeech(text, token, done, false);
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
    // Tắt tiếng sói hú đáng sợ: thay bằng 2 nốt chuông đêm êm dịu
    if (!sfxEnabled) return;
    playTone(392.0, 0.28, 'sine', 0.12, 0);
    playTone(523.25, 0.36, 'sine', 0.11, 0.14);
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
    [392, 493.88, 587.33].forEach((f, idx) => {
      playTone(f, 0.2, 'sine', 0.12, idx * 0.09);
    });
  }

  // Âm thanh Phù Thủy dùng Bình Cứu (ấm áp, trong trẻo hồi sinh)
  function playWitchSave() {
    if (!sfxEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, idx) => {
      playTone(f, 0.34, 'triangle', 0.18, idx * 0.085);
      playTone(f * 1.5, 0.25, 'sine', 0.08, idx * 0.085 + 0.03);
    });
  }

  // Âm thanh Phù Thủy ném Bình Độc (vỡ thủy tinh + tiếng độc dược sủi bọt)
  function playWitchPoison() {
    if (!sfxEnabled) return;
    const ac = ensureContext();
    if (!ac) return;
    const now = ac.currentTime;

    // 1. Tiếng thủy tinh vỡ (noise burst lọc cao)
    [0, 0.06, 0.12].forEach((offset, idx) => {
      const len = Math.floor(ac.sampleRate * 0.09);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.025));
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(2400 + idx * 900, now + offset);
      bp.Q.setValueAtTime(2.5, now + offset);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.32, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.085);
      src.connect(bp);
      bp.connect(g);
      g.connect(ac.destination);
      src.start(now + offset);
    });

    // 2. Tiếng độc dược sủi bọt trượt trầm
    const osc = ac.createOscillator();
    const lp = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.72);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, now + 0.08);
    lp.frequency.exponentialRampToValueAtTime(240, now + 0.72);
    gain.gain.setValueAtTime(0.001, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(ac.destination);
    osc.start(now + 0.08);
    osc.stop(now + 0.78);

    // 3. Tiếng bong bóng độc
    [0.18, 0.3, 0.44].forEach((delay, i) => {
      playTone(320 - i * 45, 0.12, 'sine', 0.16, delay);
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
    setVoiceGender,
    toggleVoiceGender,
    speak,
    stopSpeech,
    playWolfHowl,
    playNightAmbience,
    playRoosterDawn,
    playHeartbeat,
    playWitchPotion,
    playWitchSave,
    playWitchPoison,
    playHunterShot,
    playVoteGavel,
    playVictory,
    playTick
  };
})();
