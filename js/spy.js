// Game 2: Gián Điệp v2.1 — Tất cả cùng chơi (3 Chế độ, 5 Bộ chủ đề, Thẻ ảnh nền, Bot dẫn vòng & Đồng bộ Vote trực tiếp)
window.SpyGame = (() => {
  const {
    SPY_CARD_THEMES,
    UNDERCOVER_DECKS,
    getDeckPairs,
    TWIST_QUESTION_PAIRS,
    SPYFALL_LOCATIONS,
    SPYFALL_QUESTIONS,
    ROUND_SPARKS
  } = window.GameData;

  let session = null;
  let isHost = false;
  let myName = '';
  let state = null;
  let mySecret = null; // { mode, role, word, hint, question, location, locRole }
  let cardRevealed = false;
  let crossedLocations = new Set();
  let lastReceivedSeq = -1;
  let demoCounter = 1;
  let voteAllAnnounced = false;

  function createInitialState(roomCode) {
    return {
      stateSeq: 0,
      roomCode,
      hostId: null,
      phase: 'LOBBY', // LOBBY | PLAYING | MR_WHITE_GUESS | GAME_OVER
      config: {
        mode: 'undercover', // 'undercover' | 'twist' | 'spyfall'
        deckKey: 'all',
        spyCount: 1,
        mrWhite: false
      },
      round: 1,
      roundSpark: '',
      twistQuestionRevealed: false,
      revealedQuestionText: '',
      players: [], // { id, name, ready, alive, isDemo, role (host-only), word, locRole }
      turnOrder: [],
      votes: {}, // { voterId: targetId }
      pendingMrWhiteId: null,
      winner: null, // 'civilian' | 'spy' | 'mr_white'
      winReason: '',
      answerSummary: null,
      crossedResetToken: 0
    };
  }

  function getPublicState(s) {
    const revealAll = s.phase === 'GAME_OVER';
    return {
      stateSeq: s.stateSeq,
      roomCode: s.roomCode,
      hostId: s.hostId,
      phase: s.phase,
      config: s.config,
      round: s.round,
      roundSpark: s.roundSpark,
      twistQuestionRevealed: s.twistQuestionRevealed,
      revealedQuestionText: s.twistQuestionRevealed || revealAll ? s.revealedQuestionText : '',
      turnOrder: s.turnOrder,
      votes: s.votes,
      pendingMrWhiteId: s.pendingMrWhiteId,
      winner: s.winner,
      winReason: s.winReason,
      answerSummary: revealAll ? s.answerSummary : null,
      crossedResetToken: s.crossedResetToken,
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        alive: p.alive,
        isDemo: p.isDemo,
        role: revealAll ? p.role : null,
        word: revealAll ? p.word : null,
        locRole: revealAll ? p.locRole : null
      }))
    };
  }

  function syncStateToClients() {
    if (!isHost || !session || !state) return;
    state.stateSeq += 1;
    session.send('SPY_STATE', getPublicState(state));
  }

  function deliverSecretToPlayer(player) {
    if (!isHost || !state) return;
    const secretPayload = {
      mode: state.config.mode,
      role: player.role,
      word: player.word || null,
      hint: state.answerSummary ? state.answerSummary.hint || null : null,
      question: player.question || null,
      location: state.answerSummary ? state.answerSummary.location : null,
      locRole: player.locRole || null
    };

    if (player.id === session.clientId) {
      mySecret = secretPayload;
    } else if (!player.isDemo && session) {
      session.send('SPY_SECRET', secretPayload, player.id);
    }
  }

  // ==================== ENTRY POINTS ====================
  function startHost(roomCode, hostName) {
    cleanup();
    isHost = true;
    myName = hostName;
    demoCounter = 1;
    state = createInitialState(roomCode);

    session = window.RoomNetwork.createSession({
      gameType: 'spy',
      roomCode,
      isHost: true,
      onMessage: handleHostMessage,
      onStatus: (txt, ok) => updateNetBadge('spy-net-status', txt, ok)
    });

    state.hostId = session.clientId;
    state.players.push({
      id: session.clientId,
      name: myName,
      ready: false,
      alive: true,
      isDemo: false,
      role: null
    });

    bindEvents();
    renderShareBox();
    window.AppUI.showView('view-spy-room');
    render();
  }

  function joinAsPlayer(roomCode, playerName) {
    cleanup();
    isHost = false;
    myName = playerName;
    lastReceivedSeq = -1;
    state = createInitialState(roomCode);

    const announceJoin = () => {
      if (!session || isHost) return;
      session.send('SPY_JOIN', { name: myName });
    };

    session = window.RoomNetwork.createSession({
      gameType: 'spy',
      roomCode,
      isHost: false,
      onMessage: handleClientMessage,
      onStatus: (txt, ok) => updateNetBadge('spy-net-status', txt, ok),
      onConnected: announceJoin
    });

    bindEvents();
    window.AppUI.showView('view-spy-room');
    render();

    announceJoin();
    setTimeout(announceJoin, 900);
    setTimeout(announceJoin, 2400);
  }

  function cleanup() {
    window.AudioEngine.stopSpeech();
    if (session) {
      session.destroy();
      session = null;
    }
    state = null;
    mySecret = null;
    cardRevealed = false;
    crossedLocations.clear();
  }

  // ==================== HOST MESSAGE HANDLER ====================
  function handleHostMessage(msg) {
    if (!state) return;
    const { senderId, type, payload } = msg;

    if (type === 'SPY_JOIN') {
      const cleanName = String(payload.name || 'Người chơi').trim().slice(0, 20) || 'Người chơi';
      let player = state.players.find((p) => p.id === senderId);
      if (!player) {
        if (state.phase !== 'LOBBY') {
          const byName = state.players.find(
            (p) => p.name.toLowerCase() === cleanName.toLowerCase() && !p.isDemo
          );
          if (byName) {
            const oldId = byName.id;
            byName.id = senderId;
            if (state.pendingMrWhiteId === oldId) state.pendingMrWhiteId = senderId;
            syncStateToClients();
            deliverSecretToPlayer(byName);
          }
          return;
        }
        player = {
          id: senderId,
          name: cleanName,
          ready: false,
          alive: true,
          isDemo: false,
          role: null
        };
        state.players.push(player);
      } else if (state.phase === 'LOBBY') {
        player.name = cleanName;
      }

      syncStateToClients();
      if (state.phase !== 'LOBBY') {
        deliverSecretToPlayer(player);
      }
      render();
      return;
    }

    if (type === 'SPY_RENAME') {
      const p = state.players.find((x) => x.id === senderId);
      if (p && state.phase === 'LOBBY') {
        p.name = String(payload.name || p.name).trim().slice(0, 20) || p.name;
        syncStateToClients();
        render();
      }
      return;
    }

    if (type === 'SPY_READY') {
      const p = state.players.find((x) => x.id === senderId);
      if (p && state.phase === 'LOBBY') {
        p.ready = Boolean(payload.ready);
        syncStateToClients();
        render();
      }
      return;
    }

    if (type === 'SPY_LEAVE') {
      if (state.phase === 'LOBBY') {
        state.players = state.players.filter((x) => x.id !== senderId);
        syncStateToClients();
        render();
      }
      return;
    }

    if (type === 'SPY_VOTE' && state.phase === 'PLAYING') {
      recordSpyVote(senderId, payload.targetId);
      return;
    }

    if (type === 'SPY_MRWHITE_GUESS' && state.phase === 'MR_WHITE_GUESS' && senderId === state.pendingMrWhiteId) {
      resolveMrWhiteGuess(payload.guessText || '');
      return;
    }

    if (type === 'SPY_LOCATION_GUESS' && state.phase === 'PLAYING') {
      const spy = state.players.find((x) => x.id === senderId && x.alive && x.role === 'spy');
      if (spy) {
        resolveSpyfallLocationGuess(spy, payload.location || '');
      }
    }
  }

  function recordSpyVote(voterId, targetId) {
    const voter = state.players.find((x) => x.id === voterId && x.alive);
    const target = state.players.find((x) => x.id === targetId && x.alive);
    if (!voter || !target || voter.id === target.id) return;
    state.votes[voterId] = targetId;
    syncStateToClients();
    render();
    checkAllSpyVoted();
  }

  function checkAllSpyVoted() {
    if (voteAllAnnounced || !state || state.phase !== 'PLAYING') return;
    const realAlive = state.players.filter((p) => p.alive && !p.isDemo);
    if (realAlive.length === 0) return;
    if (realAlive.every((p) => Boolean(state.votes[p.id]))) {
      voteAllAnnounced = true;
      window.AudioEngine.playVoteGavel();
      const sorted = Object.entries(getVoteCounts()).sort((a, b) => b[1] - a[1]);
      if (sorted[0]) {
        const topPlayer = state.players.find((p) => p.id === sorted[0][0]);
        window.AudioEngine.speak(
          `Mọi người đã bỏ phiếu xong! ${topPlayer ? topPlayer.name : ''} đang có nhiều phiếu nghi ngờ nhất.`
        );
      }
    }
  }

  // ==================== HOST GAME LOGIC ====================
  function startNewRoundGame() {
    if (!isHost || !state) return;
    window.AudioEngine.unlock();

    const n = state.players.length;
    const spiesWanted = Math.min(state.config.spyCount || 1, Math.max(1, Math.floor((n - 1) / 2)));
    const wantMrWhite = state.config.mode === 'undercover' && state.config.mrWhite && n >= spiesWanted + 2;

    const indices = state.players.map((_, i) => i);
    shuffle(indices);

    state.round = 1;
    state.votes = {};
    voteAllAnnounced = false;
    state.pendingMrWhiteId = null;
    state.winner = null;
    state.winReason = '';
    state.twistQuestionRevealed = false;
    state.revealedQuestionText = '';
    state.crossedResetToken += 1;
    crossedLocations.clear();
    cardRevealed = false;

    state.players.forEach((p) => {
      p.alive = true;
      p.role = 'civilian';
      p.word = null;
      p.question = null;
      p.locRole = null;
    });

    if (state.config.mode === 'undercover') {
      const pairs = getDeckPairs(state.config.deckKey);
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const flip = Math.random() < 0.5;
      const civilianWord = flip ? pair[0] : pair[1];
      const spyWord = flip ? pair[1] : pair[0];

      for (let i = 0; i < spiesWanted; i++) {
        state.players[indices[i]].role = 'spy';
        state.players[indices[i]].word = spyWord;
      }
      if (wantMrWhite) {
        state.players[indices[spiesWanted]].role = 'mr_white';
        state.players[indices[spiesWanted]].word = null;
      }
      state.players.forEach((p) => {
        if (p.role === 'civilian') p.word = civilianWord;
      });

      state.answerSummary = {
        mode: 'undercover',
        category: pair[2] || 'Chung',
        hint: pair[3] || '',
        civilianWord,
        spyWord,
        location: null
      };
      state.roundSpark = ROUND_SPARKS[0];
    } else if (state.config.mode === 'twist') {
      const pair = TWIST_QUESTION_PAIRS[Math.floor(Math.random() * TWIST_QUESTION_PAIRS.length)];
      const flip = Math.random() < 0.5;
      const qCiv = flip ? pair[0] : pair[1];
      const qSpy = flip ? pair[1] : pair[0];

      for (let i = 0; i < spiesWanted; i++) {
        state.players[indices[i]].role = 'spy';
        state.players[indices[i]].question = qSpy;
      }
      state.players.forEach((p) => {
        if (p.role === 'civilian') p.question = qCiv;
      });

      state.revealedQuestionText = qCiv;
      state.answerSummary = {
        mode: 'twist',
        category: pair[2] || 'Hỏi xoáy',
        civilianWord: qCiv,
        spyWord: qSpy,
        location: null
      };
      state.roundSpark = 'Mọi người lần lượt trả lời câu hỏi trên thẻ (cấm đọc đề), xong rồi bấm Lật Câu Hỏi Thật!';
    } else {
      const loc = SPYFALL_LOCATIONS[Math.floor(Math.random() * SPYFALL_LOCATIONS.length)];
      const shuffledRoles = [...loc.roles];
      shuffle(shuffledRoles);

      for (let i = 0; i < spiesWanted; i++) {
        state.players[indices[i]].role = 'spy';
      }
      let roleCursor = 0;
      state.players.forEach((p) => {
        if (p.role === 'civilian') {
          p.locRole = shuffledRoles[roleCursor % shuffledRoles.length];
          roleCursor += 1;
        }
      });

      state.answerSummary = {
        mode: 'spyfall',
        location: loc.name,
        civilianWord: null,
        spyWord: null
      };
      state.roundSpark = 'Đặt câu hỏi qua lại để tìm ai không biết địa điểm bí mật!';
    }

    const orderIds = state.players.map((p) => p.id);
    shuffle(orderIds);
    state.turnOrder = orderIds;
    state.phase = 'PLAYING';

    state.players.forEach((p) => deliverSecretToPlayer(p));
    syncStateToClients();
    render();
    window.AudioEngine.playRoosterDawn();

    const firstSpeaker = state.players.find((p) => p.id === state.turnOrder[0]);
    if (state.config.mode === 'undercover') {
      window.AudioEngine.speak(
        `Ván Gián Điệp bắt đầu! Mọi người hãy lật thẻ xem từ khóa. Người phát biểu đầu tiên là ${
          firstSpeaker ? firstSpeaker.name : ''
        }. ${state.roundSpark}`
      );
    } else if (state.config.mode === 'twist') {
      window.AudioEngine.speak(
        `Chế độ Hỏi Xoáy bắt đầu! Hãy đọc thầm câu hỏi trên thẻ và lần lượt trả lời thành tiếng, bắt đầu từ ${
          firstSpeaker ? firstSpeaker.name : ''
        }!`
      );
    } else {
      window.AudioEngine.speak(
        `Spyfall bắt đầu! Dân thường hãy xem địa điểm bí mật, còn Gián Điệp hãy lắng nghe thật kỹ nhé!`
      );
    }
  }

  function revealTwistQuestion() {
    if (!isHost || !state || state.config.mode !== 'twist') return;
    state.twistQuestionRevealed = true;
    syncStateToClients();
    render();
    window.AudioEngine.playVoteGavel();
    window.AudioEngine.speak(`Câu hỏi thật của Dân Thường là: ${state.revealedQuestionText}`);
  }

  function eliminatePlayer(targetId) {
    if (!isHost || !state || state.phase !== 'PLAYING') return;
    const target = state.players.find((p) => p.id === targetId && p.alive);
    if (!target) return;

    window.AudioEngine.playVoteGavel();
    target.alive = false;
    state.votes = {};
    voteAllAnnounced = false;

    if (state.config.mode === 'undercover' && target.role === 'mr_white') {
      state.phase = 'MR_WHITE_GUESS';
      state.pendingMrWhiteId = target.id;
      syncStateToClients();
      render();
      window.AudioEngine.speak(`${target.name} chính là Mr White! Mời ${target.name} đoán từ khóa của Dân Thường.`);
      if (target.id === session.clientId) {
        openGuessDialog('mr_white');
      } else if (target.isDemo) {
        setTimeout(() => resolveMrWhiteGuess(''), 1400);
      }
      return;
    }

    evaluateAfterElimination(target);
  }

  function resolveMrWhiteGuess(guessText) {
    if (!state || state.phase !== 'MR_WHITE_GUESS') return;
    const mrWhite = state.players.find((p) => p.id === state.pendingMrWhiteId);
    state.pendingMrWhiteId = null;

    const cleanGuess = String(guessText || '').trim().toLowerCase().normalize('NFC');
    const cleanAnswer = String(state.answerSummary?.civilianWord || '').trim().toLowerCase().normalize('NFC');

    if (cleanGuess && cleanGuess === cleanAnswer) {
      endGame(
        'mr_white',
        `${mrWhite ? mrWhite.name : 'Mr. White'} đã đoán trúng từ khóa "${state.answerSummary.civilianWord}" và lật kèo chiến thắng!`
      );
      return;
    }

    window.AppUI.showToast(`Mr. White đoán "${guessText || '...'}" — Không chính xác!`);
    evaluateAfterElimination(mrWhite);
  }

  function resolveSpyfallLocationGuess(spyPlayer, guessedLocation) {
    const targetLoc = state.answerSummary?.location || '';
    if (guessedLocation === targetLoc) {
      endGame('spy', `Gián Điệp ${spyPlayer.name} đã đoán chính xác địa điểm "${targetLoc}"!`);
    } else {
      endGame(
        'civilian',
        `Gián Điệp ${spyPlayer.name} đoán nhầm thành "${guessedLocation}" (Đáp án đúng là "${targetLoc}"). Phe Dân Thường thắng!`
      );
    }
  }

  function evaluateAfterElimination(eliminated) {
    const alive = state.players.filter((p) => p.alive);
    const aliveBad = alive.filter((p) => p.role === 'spy' || p.role === 'mr_white');
    const aliveCiv = alive.filter((p) => p.role === 'civilian');

    if (state.config.mode === 'spyfall') {
      if (eliminated && eliminated.role === 'spy' && aliveBad.length === 0) {
        endGame('civilian', `Chúc mừng! Cả hội đã bắt đúng Gián Điệp ${eliminated.name}!`);
        return;
      }
      if (eliminated && eliminated.role === 'civilian' && aliveBad.length >= aliveCiv.length) {
        endGame('spy', `Bắt nhầm Dân Thường ${eliminated.name}! Gián Điệp đã thoát thành công!`);
        return;
      }
      advanceToNextRound(
        eliminated ? `${eliminated.name} (${eliminated.role === 'spy' ? 'Gián Điệp' : 'Dân Thường'}) đã bị loại!` : ''
      );
      return;
    }

    // Undercover & Twist
    if (aliveBad.length === 0) {
      endGame('civilian', 'Toàn bộ Gián Điệp đã bị vạch mặt! Phe Dân Thường chiến thắng!');
      return;
    }
    if (aliveBad.length >= aliveCiv.length) {
      endGame('spy', 'Số Gián Điệp còn lại đã ngang bằng Phe Dân! Phe Gián Điệp chiến thắng!');
      return;
    }

    const roleLabel =
      eliminated?.role === 'spy' ? 'Gián Điệp' : eliminated?.role === 'mr_white' ? 'Mr. White' : 'Dân Thường';
    advanceToNextRound(eliminated ? `${eliminated.name} đã bị loại (${roleLabel})!` : '');
  }

  function advanceToNextRound(notice) {
    state.phase = 'PLAYING';
    state.round += 1;
    state.votes = {};
    voteAllAnnounced = false;
    state.roundSpark = ROUND_SPARKS[(state.round - 1) % ROUND_SPARKS.length];
    const aliveIds = state.players.filter((p) => p.alive).map((p) => p.id);
    shuffle(aliveIds);
    state.turnOrder = aliveIds;
    syncStateToClients();
    render();
    if (notice) {
      window.AppUI.showToast(notice);
      window.AudioEngine.speak(`${notice} Bắt đầu vòng ${state.round}! ${state.roundSpark}`);
    }
  }

  function endGame(winner, winReason) {
    state.phase = 'GAME_OVER';
    state.winner = winner;
    state.winReason = winReason;
    window.AudioEngine.playVictory();
    syncStateToClients();
    render();
    window.AudioEngine.speak(winReason);
  }

  // ==================== CLIENT MESSAGE HANDLER ====================
  function handleClientMessage(msg) {
    if (!state) return;
    const { type, payload } = msg;

    if (type === 'SPY_STATE') {
      if (
        typeof payload.stateSeq === 'number' &&
        payload.phase !== 'LOBBY' &&
        payload.stateSeq < lastReceivedSeq
      ) {
        return;
      }
      if (typeof payload.stateSeq === 'number') {
        lastReceivedSeq = payload.stateSeq;
      }

      const prevReset = state.crossedResetToken;
      state = { ...state, ...payload };
      if (state.phase === 'LOBBY') {
        mySecret = null;
        cardRevealed = false;
      }
      if (payload.crossedResetToken !== prevReset) {
        crossedLocations.clear();
        cardRevealed = false;
      }
      render();

      if (state.phase === 'MR_WHITE_GUESS' && state.pendingMrWhiteId === session.clientId) {
        openGuessDialog('mr_white');
      }
      return;
    }

    if (type === 'SPY_SECRET') {
      mySecret = payload;
      render();
    }
  }

  // ==================== UI BINDING & RENDER ====================
  function bindEvents() {
    document.getElementById('spy-copy-link').onclick = () => {
      const url = window.RoomNetwork.buildShareUrl('spy', state.roomCode);
      window.AppUI.copyText(url, 'Đã copy link mời phòng Gián Điệp!');
    };

    document.getElementById('spy-leave').onclick = () => {
      if (!isHost && session) session.send('SPY_LEAVE', {});
      cleanup();
      window.AppUI.goHome();
    };

    document.getElementById('spy-edit-name').onclick = async () => {
      const newName = await window.AppUI.promptNameDialog(myName);
      if (newName && newName !== myName) {
        myName = newName;
        if (isHost) {
          const me = state.players.find((p) => p.id === session.clientId);
          if (me) me.name = myName;
          syncStateToClients();
          render();
        } else {
          session.send('SPY_RENAME', { name: myName });
        }
      }
    };

    document.getElementById('spy-ready-btn').onclick = () => {
      window.AudioEngine.unlock();
      const me = state.players.find((p) => p.id === session.clientId);
      const nextReady = me ? !me.ready : true;
      if (isHost) {
        if (me) me.ready = nextReady;
        syncStateToClients();
        render();
      } else {
        session.send('SPY_READY', { ready: nextReady });
      }
    };

    document.getElementById('spy-add-demo').onclick = () => {
      if (!isHost || state.phase !== 'LOBBY') return;
      const demoNames = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Ngọc'];
      const name = `${demoNames[(demoCounter - 1) % demoNames.length]} (Test ${demoCounter})`;
      demoCounter += 1;
      state.players.push({
        id: `spydemo_${Date.now()}_${demoCounter}`,
        name,
        ready: true,
        alive: true,
        isDemo: true,
        role: null
      });
      syncStateToClients();
      render();
    };

    const cfgForm = document.getElementById('spy-config-form');
    cfgForm.onchange = () => {
      if (!isHost || !state || state.phase !== 'LOBBY') return;
      const modeInput = cfgForm.querySelector('input[name="spyMode"]:checked');
      state.config.mode = modeInput ? modeInput.value : 'undercover';
      state.config.deckKey = document.getElementById('spy-deck-select').value || 'all';
      state.config.spyCount = Number(document.getElementById('spy-count-select').value) || 1;
      state.config.mrWhite = document.getElementById('spy-mrwhite-check').checked;
      syncStateToClients();
      render();
    };

    document.getElementById('spy-start-btn').onclick = () => startNewRoundGame();

    document.getElementById('spy-toggle-card').onclick = () => {
      cardRevealed = !cardRevealed;
      renderSecretCard();
    };

    document.getElementById('spy-twist-reveal-btn').onclick = () => revealTwistQuestion();
    document.getElementById('spy-open-guess-location').onclick = () => openGuessDialog('spyfall');

    document.getElementById('spy-finalize-vote').onclick = async () => {
      if (!isHost || state.phase !== 'PLAYING') return;
      const counts = getVoteCounts();
      const entries = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
      if (entries.length === 0) {
        window.AppUI.showToast('Chưa có ai bấm Vote trên điện thoại! Hãy bấm nút Loại trực tiếp bên cạnh tên.');
        return;
      }
      const topId = entries[0][0];
      const topPlayer = state.players.find((p) => p.id === topId);
      const ok = await window.AppUI.confirmDialog(
        'Chốt kết quả bỏ phiếu?',
        `Loại ${topPlayer ? topPlayer.name : '?'} (${entries[0][1].length} phiếu)?`
      );
      if (ok) eliminatePlayer(topId);
    };

    document.getElementById('spy-skip-round').onclick = () => {
      if (!isHost || state.phase !== 'PLAYING') return;
      window.AudioEngine.playVoteGavel();
      advanceToNextRound('Hòa phiếu! Chuyển sang vòng tiếp theo.');
    };

    document.getElementById('spy-play-again').onclick = () => {
      if (!isHost) return;
      state.phase = 'LOBBY';
      state.votes = {};
      voteAllAnnounced = false;
      state.winner = null;
      state.twistQuestionRevealed = false;
      state.players.forEach((p) => {
        p.alive = true;
        p.role = null;
        if (!p.isDemo) p.ready = false;
      });
      syncStateToClients();
      render();
    };
  }

  function openGuessDialog(kind) {
    const dialog = document.getElementById('dialog-guess');
    const titleEl = document.getElementById('dialog-guess-title');
    const descEl = document.getElementById('dialog-guess-desc');
    const textWrap = document.getElementById('dialog-guess-text-wrap');
    const selectWrap = document.getElementById('dialog-guess-select-wrap');
    const textInput = document.getElementById('dialog-guess-input');
    const selectInput = document.getElementById('dialog-guess-select');
    const cancelBtn = document.getElementById('dialog-guess-cancel');

    if (kind === 'mr_white') {
      titleEl.textContent = '🃏 Cơ hội lật kèo cho Mr. White!';
      descEl.textContent = 'Bạn vừa bị loại. Hãy nhập từ khóa của Dân Thường để cướp chiến thắng!';
      textWrap.hidden = false;
      selectWrap.hidden = true;
      textInput.value = '';
      textInput.required = true;
      cancelBtn.hidden = true;
    } else {
      titleEl.textContent = '🎯 Gián Điệp đoán Địa Điểm';
      descEl.textContent = 'Nếu đoán đúng bạn sẽ thắng ngay lập tức. Nếu sai, Phe Dân Thường thắng!';
      textWrap.hidden = true;
      selectWrap.hidden = false;
      textInput.required = false;
      cancelBtn.hidden = false;
      selectInput.innerHTML = '';
      SPYFALL_LOCATIONS.forEach((loc) => {
        const opt = document.createElement('option');
        opt.value = loc.name;
        opt.textContent = loc.name;
        selectInput.appendChild(opt);
      });
    }

    const form = document.getElementById('form-dialog-guess');
    cancelBtn.onclick = () => {
      dialog.returnValue = 'cancel';
      dialog.close();
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      if (kind === 'mr_white') {
        const val = textInput.value.trim();
        if (!val) return;
        dialog.close('confirm');
        if (isHost) resolveMrWhiteGuess(val);
        else session.send('SPY_MRWHITE_GUESS', { guessText: val });
      } else {
        const loc = selectInput.value;
        dialog.close('confirm');
        if (isHost) {
          const me = state.players.find((p) => p.id === session.clientId);
          resolveSpyfallLocationGuess(me, loc);
        } else {
          session.send('SPY_LOCATION_GUESS', { location: loc });
        }
      }
    };

    if (!dialog.open) dialog.showModal();
  }

  function renderShareBox() {
    document.getElementById('spy-room-code').textContent = state.roomCode;
    const shareUrl = window.RoomNetwork.buildShareUrl('spy', state.roomCode);
    document.getElementById('spy-share-url').textContent = shareUrl;
    window.AppUI.renderQrCode(document.getElementById('spy-qr'), shareUrl);
  }

  function render() {
    if (!state || !session) return;
    document.getElementById('spy-room-code').textContent = state.roomCode;
    document.getElementById('spy-my-name').textContent = myName;

    const lobbyEl = document.getElementById('spy-lobby');
    const gameEl = document.getElementById('spy-game');

    if (state.phase === 'LOBBY') {
      lobbyEl.hidden = false;
      gameEl.hidden = true;
      renderLobby();
    } else {
      lobbyEl.hidden = true;
      gameEl.hidden = false;
      renderActiveGame();
    }
  }

  function renderLobby() {
    const count = state.players.length;
    const readyCount = state.players.filter((p) => p.ready).length;
    document.getElementById('spy-player-count').textContent = String(count);
    document.getElementById('spy-ready-summary').textContent = `${readyCount}/${count} sẵn sàng`;
    document.getElementById('spy-host-demo-wrap').hidden = !isHost;

    const me = state.players.find((p) => p.id === session.clientId);
    const readyBtn = document.getElementById('spy-ready-btn');
    if (me && me.ready) {
      readyBtn.textContent = '⏳ Đã Sẵn Sàng (Ấn để hủy)';
      readyBtn.className = 'btn btn-secondary btn-lg btn-block';
    } else {
      readyBtn.textContent = '✅ Ấn Sẵn Sàng';
      readyBtn.className = 'btn btn-success btn-lg btn-block';
    }

    const listEl = document.getElementById('spy-player-list');
    listEl.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = 'player-item';
      const label = `${p.name}${p.id === session.clientId ? ' (Bạn)' : ''}${p.id === state.hostId ? ' 👑' : ''}`;
      li.innerHTML = `<span class="player-name-wrap">${escapeHtml(label)}</span><span class="pill ${
        p.ready ? 'pill-ready' : 'pill-wait'
      }">${p.ready ? 'Sẵn sàng' : 'Đang chờ'}</span>`;
      listEl.appendChild(li);
    });

    const cfgForm = document.getElementById('spy-config-form');
    cfgForm.querySelectorAll('input[name="spyMode"]').forEach((r) => {
      r.checked = r.value === state.config.mode;
      r.disabled = !isHost;
    });

    const deckRow = document.getElementById('spy-deck-row');
    deckRow.hidden = state.config.mode !== 'undercover';
    const deckSel = document.getElementById('spy-deck-select');
    deckSel.value = state.config.deckKey || 'all';
    deckSel.disabled = !isHost;

    const countSel = document.getElementById('spy-count-select');
    countSel.value = String(state.config.spyCount);
    countSel.disabled = !isHost;

    const mrWhiteRow = document.getElementById('spy-mrwhite-row');
    mrWhiteRow.hidden = state.config.mode !== 'undercover';
    const mrWhiteCheck = document.getElementById('spy-mrwhite-check');
    mrWhiteCheck.checked = Boolean(state.config.mrWhite);
    mrWhiteCheck.disabled = !isHost;

    const startBtn = document.getElementById('spy-start-btn');
    startBtn.hidden = !isHost;
    startBtn.disabled = !(isHost && count >= 3 && readyCount === count);

    const hintEl = document.getElementById('spy-lobby-hint');
    if (count < 3) {
      hintEl.textContent = `Cần tối thiểu 3 người chơi (khuyên dùng 5–10 người). Hiện có ${count} người.`;
    } else if (readyCount < count) {
      hintEl.textContent = `Đang chờ ${count - readyCount} người ấn Sẵn sàng...`;
    } else {
      hintEl.textContent = isHost
        ? '🎉 Mọi người đã sẵn sàng! Ấn "Chia bài & Bắt đầu chơi"!'
        : '🎉 Tất cả đã sẵn sàng! Đang chờ chủ phòng bấm Bắt đầu...';
    }
  }

  function renderSecretCard() {
    const btn = document.getElementById('spy-toggle-card');
    const bgLayer = document.getElementById('spy-card-bg');
    const front = document.getElementById('spy-card-front');
    const back = document.getElementById('spy-card-back');
    btn.setAttribute('aria-expanded', String(cardRevealed));
    front.hidden = cardRevealed;
    back.hidden = !cardRevealed;

    if (!mySecret) return;
    const theme = SPY_CARD_THEMES[mySecret.role] || SPY_CARD_THEMES.civilian;
    if (bgLayer && theme.bgImage) {
      bgLayer.style.backgroundImage = `url('${theme.bgImage}')`;
    }
    if (theme.themeColor) {
      btn.style.setProperty('--role-theme', theme.themeColor);
    }

    const iconEl = document.getElementById('spy-card-icon');
    const titleEl = document.getElementById('spy-card-title');
    const detailEl = document.getElementById('spy-card-detail');
    const hintEl = document.getElementById('spy-card-hint');
    hintEl.hidden = true;

    if (state.config.mode === 'undercover') {
      if (mySecret.role === 'mr_white') {
        iconEl.textContent = '🃏';
        titleEl.textContent = 'BẠN LÀ MR. WHITE';
        detailEl.textContent = 'Thẻ trắng! Lắng nghe mọi người mô tả để đoán ra từ khóa Dân Thường.';
      } else {
        iconEl.textContent = '📝';
        titleEl.textContent = mySecret.word || '---';
        detailEl.textContent = 'Hãy mô tả từ khóa này thật khéo mà không làm lộ quá sớm!';
        if (mySecret.hint) {
          hintEl.hidden = false;
          hintEl.textContent = mySecret.hint;
        }
      }
    } else if (state.config.mode === 'twist') {
      iconEl.textContent = '❓';
      titleEl.textContent = 'CÂU HỎI BÍ MẬT CỦA BẠN';
      detailEl.textContent = mySecret.question || '---';
      hintEl.hidden = false;
      hintEl.textContent = 'Chỉ nói câu trả lời của bạn — KHÔNG đọc câu hỏi lên!';
    } else {
      if (mySecret.role === 'spy') {
        iconEl.textContent = '🕵️';
        titleEl.textContent = 'BẠN LÀ GIÁN ĐIỆP!';
        detailEl.textContent = 'Bạn không biết địa điểm. Hãy đặt câu hỏi và lắng nghe để đoán trúng địa điểm!';
      } else {
        iconEl.textContent = '📍';
        titleEl.textContent = mySecret.location || '---';
        detailEl.textContent = `Vai trò gợi ý của bạn: ${mySecret.locRole || 'Khách'}`;
      }
    }
  }

  function getVoteCounts() {
    const groups = {};
    Object.entries(state.votes || {}).forEach(([vId, targetId]) => {
      const voter = state.players.find((p) => p.id === vId);
      if (!voter || !voter.alive) return;
      if (!groups[targetId]) groups[targetId] = [];
      groups[targetId].push(voter.name);
    });
    return groups;
  }

  function renderActiveGame() {
    const modeNames = {
      undercover: 'AI LÀ GIÁN ĐIỆP',
      twist: 'ĐIỆP VIÊN HỎI XOÁY',
      spyfall: 'SPYFALL — ĐOÁN ĐỊA ĐIỂM'
    };
    document.getElementById('spy-mode-badge').textContent = modeNames[state.config.mode] || 'GIÁN ĐIỆP';
    document.getElementById('spy-round-badge').textContent = `Vòng ${state.round}`;

    const deckBadge = document.getElementById('spy-deck-badge');
    if (state.config.mode === 'undercover') {
      deckBadge.hidden = false;
      deckBadge.textContent =
        state.config.deckKey === 'all'
          ? 'Trộn tất cả'
          : UNDERCOVER_DECKS[state.config.deckKey]?.label || 'Từ khóa';
    } else {
      deckBadge.hidden = true;
    }

    document.getElementById('spy-spark-note').textContent = state.roundSpark || 'Thảo luận tự do • Vote xong ấn chốt';
    renderSecretCard();

    const isSpyfall = state.config.mode === 'spyfall';
    const isTwist = state.config.mode === 'twist';

    document.getElementById('spy-spyfall-tools').hidden = !isSpyfall;
    document.getElementById('spy-twist-tools').hidden = !isTwist;
    document.getElementById('spy-order-box').hidden = isSpyfall;

    if (isTwist) {
      const revBanner = document.getElementById('spy-twist-revealed-banner');
      const revBtn = document.getElementById('spy-twist-reveal-btn');
      revBanner.hidden = !state.twistQuestionRevealed;
      if (state.twistQuestionRevealed) {
        document.getElementById('spy-twist-real-question').textContent = state.revealedQuestionText || '';
      }
      revBtn.hidden = !(isHost && state.phase === 'PLAYING' && !state.twistQuestionRevealed);
    }

    if (isSpyfall) {
      const meAlive = state.players.find((p) => p.id === session.clientId)?.alive;
      document.getElementById('spy-guess-location-wrap').hidden =
        !(state.phase === 'PLAYING' && meAlive && mySecret?.role === 'spy');

      const grid = document.getElementById('spy-locations-grid');
      grid.innerHTML = '';
      SPYFALL_LOCATIONS.forEach((loc) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `loc-chip ${crossedLocations.has(loc.name) ? 'crossed' : ''}`;
        chip.textContent = loc.name;
        chip.addEventListener('click', () => {
          if (crossedLocations.has(loc.name)) crossedLocations.delete(loc.name);
          else crossedLocations.add(loc.name);
          renderActiveGame();
        });
        grid.appendChild(chip);
      });

      const qList = document.getElementById('spy-spyfall-questions-list');
      if (qList.childElementCount === 0) {
        SPYFALL_QUESTIONS.forEach((q) => {
          const li = document.createElement('li');
          li.textContent = q;
          qList.appendChild(li);
        });
      }
    } else {
      const orderList = document.getElementById('spy-order-list');
      orderList.innerHTML = '';
      (state.turnOrder || []).forEach((id) => {
        const p = state.players.find((x) => x.id === id);
        if (p) {
          const li = document.createElement('li');
          li.textContent = p.name;
          orderList.appendChild(li);
        }
      });
    }

    // Live Vote + Host Elimination List
    const voteList = document.getElementById('spy-vote-list');
    voteList.innerHTML = '';
    const groups = getVoteCounts();
    const myVote = state.votes ? state.votes[session.clientId] : null;
    const me = state.players.find((p) => p.id === session.clientId);
    const canVote = state.phase === 'PLAYING' && me && me.alive;

    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = `vote-row ${p.alive ? '' : 'eliminated'}`;

      const voters = groups[p.id] || [];
      const info = document.createElement('span');
      info.innerHTML = `<strong>${escapeHtml(p.name)}</strong>${p.id === session.clientId ? ' (Bạn)' : ''} ${
        voters.length > 0
          ? `<span class="pill pill-ready">${voters.length} phiếu (${escapeHtml(voters.join(', '))})</span>`
          : ''
      }`;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '0.4rem';

      if (p.alive && canVote && p.id !== session.clientId) {
        const voteBtn = document.createElement('button');
        voteBtn.type = 'button';
        voteBtn.className = `btn btn-sm ${myVote === p.id ? 'btn-primary' : 'btn-secondary'}`;
        voteBtn.textContent = myVote === p.id ? '✓ Đã chọn' : 'Vote';
        voteBtn.addEventListener('click', () => {
          if (isHost) {
            recordSpyVote(session.clientId, p.id);
          } else {
            session.send('SPY_VOTE', { targetId: p.id });
          }
        });
        actions.appendChild(voteBtn);
      }

      if (isHost && p.alive && state.phase === 'PLAYING') {
        const elimBtn = document.createElement('button');
        elimBtn.type = 'button';
        elimBtn.className = 'btn btn-sm btn-danger-outline';
        elimBtn.textContent = 'Loại';
        elimBtn.addEventListener('click', async () => {
          const ok = await window.AppUI.confirmDialog(
            'Xác nhận loại người chơi?',
            `Loại ${p.name} khỏi ván chơi này?`
          );
          if (ok) eliminatePlayer(p.id);
        });
        actions.appendChild(elimBtn);
      }

      li.append(info, actions);
      voteList.appendChild(li);
    });

    const aliveCount = state.players.filter((p) => p.alive).length;
    const votedCount = Object.keys(state.votes || {}).length;
    document.getElementById('spy-vote-progress').textContent =
      state.phase === 'PLAYING' ? `${votedCount}/${aliveCount} đã vote` : 'Đã kết thúc';

    document.getElementById('spy-host-controls').hidden = !(isHost && state.phase === 'PLAYING');
    document.getElementById('spy-mrwhite-banner').hidden = state.phase !== 'MR_WHITE_GUESS';

    const overBox = document.getElementById('spy-gameover-box');
    overBox.hidden = state.phase !== 'GAME_OVER';
    if (state.phase === 'GAME_OVER') {
      const wMap = {
        civilian: '🏆 PHE DÂN THƯỜNG CHIẾN THẮNG!',
        spy: '🕵️ PHE GIÁN ĐIỆP CHIẾN THẮNG!',
        mr_white: '🃏 MR. WHITE LẬT KÈO CHIẾN THẮNG!'
      };
      document.getElementById('spy-winner-banner').textContent = wMap[state.winner] || 'KẾT THÚC!';
      const ans = state.answerSummary || {};
      const ansEl = document.getElementById('spy-answer-reveal');
      if (state.config.mode === 'undercover') {
        ansEl.innerHTML = `<p>${escapeHtml(state.winReason)}</p><p><strong>Từ Dân Thường:</strong> ${escapeHtml(
          ans.civilianWord
        )} • <strong>Từ Gián Điệp:</strong> ${escapeHtml(ans.spyWord)}</p>`;
      } else if (state.config.mode === 'twist') {
        ansEl.innerHTML = `<p>${escapeHtml(state.winReason)}</p><p><strong>Câu hỏi Dân Thường:</strong> ${escapeHtml(
          ans.civilianWord
        )}</p><p><strong>Câu hỏi Gián Điệp:</strong> ${escapeHtml(ans.spyWord)}</p>`;
      } else {
        ansEl.innerHTML = `<p>${escapeHtml(state.winReason)}</p><p><strong>Địa điểm bí mật:</strong> ${escapeHtml(
          ans.location
        )}</p>`;
      }

      const revList = document.getElementById('spy-reveal-list');
      revList.innerHTML = '';
      state.players.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'reveal-item';
        const roleLabel =
          p.role === 'spy' ? '🕵️ Gián Điệp' : p.role === 'mr_white' ? '🃏 Mr. White' : '🧑‍🌾 Dân Thường';
        li.innerHTML = `<span><strong>${escapeHtml(p.name)}</strong></span><span>${roleLabel}${
          p.word ? ` (${escapeHtml(p.word)})` : p.locRole ? ` (${escapeHtml(p.locRole)})` : ''
        }</span>`;
        revList.appendChild(li);
      });

      document.getElementById('spy-play-again').hidden = !isHost;
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function updateNetBadge(id, text, online) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `net-badge ${online ? '' : 'offline'}`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    startHost,
    joinAsPlayer,
    cleanup
  };
})();
