// Điều phối giao diện chính v2.2: Minimalist Active Mode, Avatar Picker, Dialogs chuẩn HTML5, QR Code & Deep-link
window.AppUI = (() => {
  const VIEW_IDS = ['view-home', 'view-werewolf-host', 'view-werewolf-player', 'view-spy-room'];
  let toastTimer = null;

  function setActiveGameMode(isActive, phaseMode = null) {
    document.body.classList.toggle('in-active-game', Boolean(isActive));
    document.body.classList.toggle('phase-night', Boolean(isActive && phaseMode === 'NIGHT'));
    document.body.classList.toggle('phase-day', Boolean(isActive && phaseMode === 'DAY'));
  }

  function getSavedAvatarId() {
    const saved = localStorage.getItem('hq_player_avatar');
    if (saved && window.GameData?.PLAYER_AVATARS?.some((a) => a.id === saved)) {
      return saved;
    }
    const randId = window.GameData?.getRandomAvatarId ? window.GameData.getRandomAvatarId() : 'boy_smile';
    localStorage.setItem('hq_player_avatar', randId);
    return randId;
  }

  function saveAvatarId(id) {
    if (id) localStorage.setItem('hq_player_avatar', id);
  }

  function createAvatarEl(avatarId, sizeClass = 'avatar-md') {
    const av = window.GameData?.getAvatarById
      ? window.GameData.getAvatarById(avatarId)
      : { emoji: '🙂', label: 'Người chơi', bg: 'linear-gradient(135deg,#6366f1,#06b6d4)' };
    const span = document.createElement('span');
    span.className = `avatar-badge ${sizeClass}`;
    span.style.background = av.bg;
    span.setAttribute('aria-hidden', 'true');
    if (av.img) {
      const img = document.createElement('img');
      img.className = 'avatar-img';
      img.src = av.img;
      img.alt = '';
      img.draggable = false;
      img.onerror = () => {
        span.textContent = av.emoji || '🙂';
      };
      span.appendChild(img);
    } else {
      span.textContent = av.emoji;
    }
    return span;
  }

  function renderAvatarPicker(container, selectedId, onSelect) {
    if (!container) return;
    const list = window.GameData?.PLAYER_AVATARS || [];
    let current = selectedId || getSavedAvatarId();
    container.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'avatar-picker-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', 'Danh sách ảnh và icon đại diện');

    list.forEach((av) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = av.img ? 'avatar-option avatar-option-photo' : 'avatar-option';
      btn.dataset.avatarId = av.id;
      btn.style.background = av.bg;
      if (av.img) {
        const img = document.createElement('img');
        img.className = 'avatar-img';
        img.src = av.img;
        img.alt = '';
        img.draggable = false;
        btn.appendChild(img);
      } else {
        btn.textContent = av.emoji;
      }
      btn.title = av.label;
      btn.setAttribute('aria-label', av.label);
      btn.setAttribute('aria-pressed', av.id === current ? 'true' : 'false');
      btn.addEventListener('click', () => {
        current = av.id;
        grid.querySelectorAll('.avatar-option').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        if (typeof onSelect === 'function') onSelect(av.id);
      });
      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  // Cơ chế Nhấn & Giữ (Hold to Peek) chống lộ bài khi quên úp thẻ
  function bindHoldToPeekCard(btnEl, setRevealed) {
    if (!btnEl || btnEl.dataset.holdBound === '1') return;
    btnEl.dataset.holdBound = '1';

    const show = (e) => {
      if (e && e.type === 'pointerdown' && e.button !== undefined && e.button !== 0) return;
      setRevealed(true);
    };
    const hide = () => setRevealed(false);

    btnEl.addEventListener('pointerdown', (e) => {
      if (btnEl.setPointerCapture && e.pointerId !== undefined) {
        try {
          btnEl.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      show(e);
    });
    btnEl.addEventListener('pointerup', hide);
    btnEl.addEventListener('pointercancel', hide);
    btnEl.addEventListener('pointerleave', hide);
    btnEl.addEventListener('lostpointercapture', hide);
    btnEl.addEventListener('blur', hide);
    btnEl.addEventListener('contextmenu', (e) => e.preventDefault());
    btnEl.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        show(e);
      }
    });
    btnEl.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') hide();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hide();
    });
  }

  function showView(viewId) {
    VIEW_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== viewId;
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function goHome() {
    setActiveGameMode(false, null);
    // Xóa query params trên URL nhưng không reload trang
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    showView('view-home');
  }

  function showToast(msg) {
    const toast = document.getElementById('toast-message');
    if (!toast) return;
    toast.textContent = msg;
    if (typeof toast.showPopover === 'function') {
      try {
        toast.showPopover();
      } catch (_) {}
    } else {
      toast.hidden = false;
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (typeof toast.hidePopover === 'function') {
        try {
          toast.hidePopover();
        } catch (_) {}
      } else {
        toast.hidden = true;
      }
    }, 3200);
  }

  async function copyText(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg || 'Đã sao chép!');
    } catch (_) {
      showToast('Hãy bôi đen và copy đường dẫn bên dưới QR!');
    }
  }

  function renderQrCode(container, url, cellSize = 7) {
    if (!container) return;
    container.innerHTML = '';
    if (typeof window.qrcode === 'function') {
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        container.innerHTML = qr.createSvgTag({ cellSize, margin: 2, scalable: true });
        return;
      } catch (_) {}
    }
    // Fallback nếu không tải được thư viện QR
    const fallback = document.createElement('div');
    fallback.style.color = '#0f172a';
    fallback.style.fontSize = '0.85rem';
    fallback.style.fontWeight = '700';
    fallback.style.textAlign = 'center';
    fallback.textContent = 'Hãy gửi đường dẫn hoặc mã phòng cho bạn bè!';
    container.appendChild(fallback);
  }

  function openQrZoomModal(title, roomCode, url) {
    const dialog = document.getElementById('dialog-qr-zoom');
    if (!dialog) return;
    const titleEl = document.getElementById('dialog-qr-zoom-title');
    const codeEl = document.getElementById('dialog-qr-zoom-code');
    const boxEl = document.getElementById('dialog-qr-zoom-box');
    const urlEl = document.getElementById('dialog-qr-zoom-url');
    if (titleEl && title) titleEl.textContent = title;
    if (codeEl) codeEl.textContent = roomCode || '----';
    if (urlEl) urlEl.textContent = url || '';
    renderQrCode(boxEl, url, 11);
    if (!dialog.open) dialog.showModal();
  }

  function confirmDialog(title, bodyText) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('dialog-confirm');
      document.getElementById('dialog-confirm-title').textContent = title;
      document.getElementById('dialog-confirm-body').textContent = bodyText;

      const onClose = () => {
        const confirmed = dialog.returnValue === 'confirm';
        dialog.returnValue = '';
        dialog.removeEventListener('close', onClose);
        resolve(confirmed);
      };
      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
  }

  function promptProfileDialog(initialName = '', initialAvatarId = '') {
    return new Promise((resolve) => {
      const dialog = document.getElementById('dialog-name');
      const input = document.getElementById('dialog-name-input');
      const form = document.getElementById('form-dialog-name');
      const pickerWrap = document.getElementById('dialog-avatar-picker');
      input.value = initialName;
      let chosenAvatar = initialAvatarId || getSavedAvatarId();

      renderAvatarPicker(pickerWrap, chosenAvatar, (id) => {
        chosenAvatar = id;
      });

      const onClose = () => {
        const confirmed = dialog.returnValue === 'confirm';
        const val = input.value.trim();
        dialog.returnValue = '';
        dialog.removeEventListener('close', onClose);
        resolve(confirmed && val ? { name: val, avatarId: chosenAvatar } : null);
      };

      form.onsubmit = (e) => {
        if (!input.value.trim()) {
          e.preventDefault();
          input.focus();
        }
      };

      dialog.addEventListener('close', onClose);
      dialog.showModal();
    });
  }

  function promptNameDialog(initialName = '') {
    return promptProfileDialog(initialName).then((res) => (res ? res.name : null));
  }

  // Fallback light-dismiss cho trình duyệt chưa hỗ trợ closedby="any"
  function attachClosedByFallback() {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }

  let openSoundModalFn = () => {};

  function openSoundSettings() {
    openSoundModalFn();
  }

  function setupDialogs() {
    attachClosedByFallback();

    // Sound Settings Dialog
    const soundDialog = document.getElementById('dialog-sound');
    const voiceChk = document.getElementById('sound-voice-enable');
    const sfxChk = document.getElementById('sound-sfx-enable');
    const ttsModeSel = document.getElementById('sound-tts-mode');
    const browserVoiceWrap = document.getElementById('sound-browser-voice-wrap');
    const voiceSel = document.getElementById('sound-voice-select');
    const rateRange = document.getElementById('sound-rate-range');
    const rateVal = document.getElementById('sound-rate-val');
    const pitchRange = document.getElementById('sound-pitch-range');
    const pitchVal = document.getElementById('sound-pitch-val');

    function populateVoices() {
      const list = window.AudioEngine.getVoices();
      const cfg = window.AudioEngine.getConfig();
      voiceSel.innerHTML = '';
      if (list.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Mặc định trình duyệt (vi-VN)';
        voiceSel.appendChild(opt);
        return;
      }
      // Ưu tiên đưa giọng Việt lên đầu
      const sorted = [...list].sort((a, b) => {
        const aVi = a.lang.toLowerCase().startsWith('vi') ? 0 : 1;
        const bVi = b.lang.toLowerCase().startsWith('vi') ? 0 : 1;
        return aVi - bVi;
      });
      sorted.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        if (v.voiceURI === cfg.voiceURI) opt.selected = true;
        voiceSel.appendChild(opt);
      });
    }

    document.addEventListener('audio-voices-updated', populateVoices);
    document.addEventListener('audio-speak-state', (e) => {
      const speaking = Boolean(e.detail?.speaking);
      const wwBotBox = document.getElementById('ww-bot-announcer');
      const spyBotBox = document.getElementById('spy-bot-announcer');
      if (wwBotBox) wwBotBox.classList.toggle('is-speaking', speaking);
      if (spyBotBox) spyBotBox.classList.toggle('is-speaking', speaking);
    });

    openSoundModalFn = () => {
      window.AudioEngine.unlock();
      populateVoices();
      browserVoiceWrap.hidden = ttsModeSel.value === 'cloud';
      soundDialog.showModal();
    };

    document.getElementById('btn-sound-settings').addEventListener('click', openSoundModalFn);

    document.getElementById('btn-close-sound').addEventListener('click', () => {
      soundDialog.returnValue = '';
      soundDialog.close();
    });

    const syncAudioCfg = () => {
      const rate = Number(rateRange.value) || 1.02;
      const pitch = pitchRange ? Number(pitchRange.value) || 1.0 : 1.0;
      rateVal.textContent = `${rate.toFixed(2).replace(/\.00$/, '.0')}x`;
      if (pitchVal) pitchVal.textContent = pitch.toFixed(2).replace(/\.00$/, '.0');
      browserVoiceWrap.hidden = ttsModeSel.value === 'cloud';
      window.AudioEngine.setConfig({
        voice: voiceChk.checked,
        sfx: sfxChk.checked,
        rate,
        pitch,
        mode: ttsModeSel.value,
        voiceURI: voiceSel.value
      });
    };

    voiceChk.addEventListener('change', syncAudioCfg);
    sfxChk.addEventListener('change', syncAudioCfg);
    ttsModeSel.addEventListener('change', syncAudioCfg);
    voiceSel.addEventListener('change', syncAudioCfg);
    rateRange.addEventListener('input', syncAudioCfg);
    if (pitchRange) pitchRange.addEventListener('input', syncAudioCfg);

    document.getElementById('btn-test-sfx').addEventListener('click', () => {
      window.AudioEngine.unlock();
      window.AudioEngine.playWolfHowl();
    });
    const testSaveBtn = document.getElementById('btn-test-witch-save');
    if (testSaveBtn) {
      testSaveBtn.addEventListener('click', () => {
        window.AudioEngine.unlock();
        window.AudioEngine.playWitchSave();
      });
    }
    const testPoisonBtn = document.getElementById('btn-test-witch-poison');
    if (testPoisonBtn) {
      testPoisonBtn.addEventListener('click', () => {
        window.AudioEngine.unlock();
        window.AudioEngine.playWitchPoison();
      });
    }

    document.getElementById('btn-test-tts').addEventListener('click', () => {
      window.AudioEngine.unlock();
      window.AudioEngine.speak('Đêm qua có một người đã thiệt mạng, đó là Minh!');
    });

    // Rules Dialog
    const rulesDialog = document.getElementById('dialog-rules');
    document.getElementById('btn-rules').addEventListener('click', () => rulesDialog.showModal());
    document.getElementById('btn-close-rules').addEventListener('click', () => {
      rulesDialog.returnValue = '';
      rulesDialog.close();
    });
    rulesDialog.addEventListener('close', () => {
      rulesDialog.returnValue = '';
    });

    // QR Zoom Dialog
    const qrZoomDialog = document.getElementById('dialog-qr-zoom');
    const closeQrBtn = document.getElementById('btn-close-qr-zoom');
    if (qrZoomDialog && closeQrBtn) {
      closeQrBtn.addEventListener('click', () => {
        qrZoomDialog.returnValue = '';
        qrZoomDialog.close();
      });
    }
  }

  function setupHomeHandlers() {
    const createWwBtn = document.getElementById('btn-create-werewolf');
    const createSpyBtn = document.getElementById('btn-create-spy');
    const joinForm = document.getElementById('form-join-room');
    const codeInput = document.getElementById('input-join-code');
    const nameInput = document.getElementById('input-join-name');
    const avatarPickerWrap = document.getElementById('join-avatar-picker');
    const errEl = document.getElementById('join-error-msg');

    // Khôi phục tên & avatar đã dùng gần nhất (nếu có)
    const savedName = localStorage.getItem('hq_player_name') || '';
    if (savedName) nameInput.value = savedName;
    let selectedAvatarId = getSavedAvatarId();

    const getActiveJoinAvatarId = () =>
      avatarPickerWrap?.querySelector('.avatar-option[aria-pressed="true"]')?.dataset.avatarId || selectedAvatarId;

    renderAvatarPicker(avatarPickerWrap, selectedAvatarId, (id) => {
      selectedAvatarId = id;
      saveAvatarId(id);
    });

    createWwBtn.addEventListener('click', () => {
      window.AudioEngine.unlock();
      const code = window.RoomNetwork.generateRoomCode();
      window.WerewolfGame.startHost(code);
    });

    createSpyBtn.addEventListener('click', () => {
      window.AudioEngine.unlock();
      const code = window.RoomNetwork.generateRoomCode();
      window.SpyGame.startHost(code);
    });

    // Clear lỗi khi đang nhập
    codeInput.addEventListener('input', () => {
      codeInput.setCustomValidity('');
      errEl.textContent = '';
    });
    nameInput.addEventListener('input', () => {
      nameInput.setCustomValidity('');
      errEl.textContent = '';
    });

    // An toàn với bộ gõ Tiếng Việt (IME) khi nhấn Enter
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.isComposing) {
        e.preventDefault();
      }
    });

    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.AudioEngine.unlock();

      const code = codeInput.value.trim();
      const playerName = nameInput.value.trim();
      const gameRadio = joinForm.querySelector('input[name="joinGameType"]:checked');
      const gameType = gameRadio ? gameRadio.value : 'werewolf';

      if (!/^\d{4}$/.test(code)) {
        errEl.textContent = 'Vui lòng nhập đúng mã phòng gồm 4 chữ số!';
        codeInput.setAttribute('aria-invalid', 'true');
        codeInput.focus();
        return;
      }
      codeInput.removeAttribute('aria-invalid');

      if (!playerName) {
        errEl.textContent = 'Vui lòng nhập tên của bạn để Bot Quản Trò gọi chính xác!';
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
        return;
      }
      nameInput.removeAttribute('aria-invalid');
      const finalAvatarId = getActiveJoinAvatarId();
      localStorage.setItem('hq_player_name', playerName);
      saveAvatarId(finalAvatarId);

      if (gameType === 'werewolf') {
        window.WerewolfGame.joinAsPlayer(code, playerName, finalAvatarId);
      } else {
        window.SpyGame.joinAsPlayer(code, playerName, finalAvatarId);
      }
    });

    // Tự điền thông tin nếu mở từ Link mời hoặc quét QR (?game=werewolf&room=1234)
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    const urlGame = params.get('game');
    if (urlRoom && /^\d{4}$/.test(urlRoom)) {
      codeInput.value = urlRoom;
      if (urlGame === 'spy') {
        document.getElementById('join-game-spy').checked = true;
      } else {
        document.getElementById('join-game-werewolf').checked = true;
      }
      showToast(`Đã điền sẵn mã phòng ${urlRoom}! Nhập tên của bạn và bấm Vào phòng.`);
      setTimeout(() => nameInput.focus(), 100);
    }
  }

  function init() {
    setupDialogs();
    setupHomeHandlers();
    showView('view-home');
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    showView,
    goHome,
    setActiveGameMode,
    getSavedAvatarId,
    saveAvatarId,
    createAvatarEl,
    renderAvatarPicker,
    bindHoldToPeekCard,
    openSoundSettings,
    showToast,
    copyText,
    renderQrCode,
    openQrZoomModal,
    confirmDialog,
    promptNameDialog,
    promptProfileDialog
  };
})();
