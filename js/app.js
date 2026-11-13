// Điều phối giao diện chính, Dialogs chuẩn HTML5, QR Code và URL Deep-link
window.AppUI = (() => {
  const VIEW_IDS = ['view-home', 'view-werewolf-host', 'view-werewolf-player', 'view-spy-room'];
  let toastTimer = null;

  function showView(viewId) {
    VIEW_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = id !== viewId;
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function goHome() {
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

  function renderQrCode(container, url) {
    if (!container) return;
    container.innerHTML = '';
    if (typeof window.qrcode === 'function') {
      try {
        const qr = window.qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        container.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
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

  function promptNameDialog(initialName = '') {
    return new Promise((resolve) => {
      const dialog = document.getElementById('dialog-name');
      const input = document.getElementById('dialog-name-input');
      const form = document.getElementById('form-dialog-name');
      input.value = initialName;

      const onClose = () => {
        const confirmed = dialog.returnValue === 'confirm';
        const val = input.value.trim();
        dialog.returnValue = '';
        dialog.removeEventListener('close', onClose);
        resolve(confirmed && val ? val : null);
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

    document.getElementById('btn-sound-settings').addEventListener('click', () => {
      window.AudioEngine.unlock();
      populateVoices();
      browserVoiceWrap.hidden = ttsModeSel.value !== 'browser';
      soundDialog.showModal();
    });

    document.getElementById('btn-close-sound').addEventListener('click', () => {
      soundDialog.returnValue = '';
      soundDialog.close();
    });

    const syncAudioCfg = () => {
      const rate = Number(rateRange.value) || 1.05;
      rateVal.textContent = `${rate.toFixed(2).replace(/\.00$/, '.0')}x`;
      browserVoiceWrap.hidden = ttsModeSel.value !== 'browser';
      window.AudioEngine.setConfig({
        voice: voiceChk.checked,
        sfx: sfxChk.checked,
        rate,
        mode: ttsModeSel.value,
        voiceURI: voiceSel.value
      });
    };

    voiceChk.addEventListener('change', syncAudioCfg);
    sfxChk.addEventListener('change', syncAudioCfg);
    ttsModeSel.addEventListener('change', syncAudioCfg);
    voiceSel.addEventListener('change', syncAudioCfg);
    rateRange.addEventListener('input', syncAudioCfg);

    document.getElementById('btn-test-sfx').addEventListener('click', () => {
      window.AudioEngine.unlock();
      window.AudioEngine.playWolfHowl();
    });

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
  }

  function setupHomeHandlers() {
    const createWwBtn = document.getElementById('btn-create-werewolf');
    const createSpyBtn = document.getElementById('btn-create-spy');
    const joinForm = document.getElementById('form-join-room');
    const codeInput = document.getElementById('input-join-code');
    const nameInput = document.getElementById('input-join-name');
    const errEl = document.getElementById('join-error-msg');

    // Khôi phục tên đã dùng gần nhất (nếu có)
    const savedName = localStorage.getItem('hq_player_name') || '';
    if (savedName) nameInput.value = savedName;

    createWwBtn.addEventListener('click', () => {
      window.AudioEngine.unlock();
      const code = window.RoomNetwork.generateRoomCode();
      window.WerewolfGame.startHost(code);
    });

    createSpyBtn.addEventListener('click', async () => {
      window.AudioEngine.unlock();
      const hostName = await promptNameDialog(savedName || 'Chủ phòng');
      if (!hostName) return;
      localStorage.setItem('hq_player_name', hostName);
      const code = window.RoomNetwork.generateRoomCode();
      window.SpyGame.startHost(code, hostName);
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
      localStorage.setItem('hq_player_name', playerName);

      if (gameType === 'werewolf') {
        window.WerewolfGame.joinAsPlayer(code, playerName);
      } else {
        window.SpyGame.joinAsPlayer(code, playerName);
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
    showToast,
    copyText,
    renderQrCode,
    confirmDialog,
    promptNameDialog
  };
})();
