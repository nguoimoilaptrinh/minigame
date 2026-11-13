// Game 1: Ma Sói v2.1 — Bot Quản Trò tự động, Thẻ bài ảnh nền, Đồng bộ Vote trực tiếp, Không đếm giờ
window.WerewolfGame = (() => {
  const { WEREWOLF_ROLES, getRecommendedWerewolfRoles } = window.GameData;

  let session = null;
  let isHost = false;
  let myName = '';
  let state = null;
  let clientSecret = null; // { roleId, teammates: [] }
  let witchInfo = null;
  let seerResult = null;
  let wolfPeersChoices = {}; // { wolfId: targetId }
  let wolfConfirmedMap = {}; // { wolfId: boolean }
  let cardRevealed = false;
  let lastReceivedSeq = -1;

  // Host-only timers & guards
  let hostStepTimer = null;
  let stepResolved = false;
  let autoRolesMode = true;
  let demoCounter = 1;
  let selectedNightTarget = null;
  let witchSaveChoice = false;
  let witchPoisonChoice = null;
  let voteAllAnnounced = false;

  function clearHostTimers() {
    if (hostStepTimer) {
      clearTimeout(hostStepTimer);
      hostStepTimer = null;
    }
  }

  function createInitialHostState(roomCode) {
    return {
      stateSeq: 0,
      roomCode,
      phase: 'LOBBY', // LOBBY | ROLE_REVEAL | NIGHT | HUNTER_REVENGE | DAY | GAME_OVER
      nightNumber: 0,
      nightStep: null, // 'guard' | 'werewolf' | 'seer' | 'witch'
      players: [], // { id, name, ready, alive, isDemo, roleId (host-only) }
      rolesConfig: getRecommendedWerewolfRoles(5),
      lastGuardedId: null,
      witchPotions: { save: true, poison: true },
      nightActions: {
        guardTarget: null,
        wolfVotes: {},
        wolfConfirmed: {},
        wolfTarget: null,
        seerTarget: null,
        witchSave: false,
        witchPoisonTarget: null
      },
      dayVotes: {}, // { voterId: targetId | '__skip__' }
      pendingHunterId: null,
      pendingHunterNext: null, // 'DAY' | 'NEXT_NIGHT'
      botText: 'Chờ tất cả người chơi vào phòng và ấn Sẵn sàng...',
      lastDawnSummary: '',
      winner: null,
      logs: []
    };
  }

  function getPublicState(s) {
    const revealAll = s.phase === 'GAME_OVER';
    return {
      stateSeq: s.stateSeq,
      roomCode: s.roomCode,
      phase: s.phase,
      nightNumber: s.nightNumber,
      nightStep: s.nightStep,
      rolesConfig: s.rolesConfig,
      lastGuardedId: s.lastGuardedId,
      dayVotes: s.dayVotes,
      pendingHunterId: s.pendingHunterId,
      botText: s.botText,
      lastDawnSummary: s.lastDawnSummary,
      winner: s.winner,
      logs: s.logs,
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        ready: p.ready,
        alive: p.alive,
        isDemo: p.isDemo,
        roleId: revealAll ? p.roleId : null
      }))
    };
  }

  function syncStateToClients() {
    if (!isHost || !session || !state) return;
    state.stateSeq += 1;
    session.send('WW_STATE', getPublicState(state));
  }

  function sendSecretToPlayer(player) {
    if (!isHost || !session || !player.roleId) return;
    const teammates =
      player.roleId === 'werewolf'
        ? state.players
            .filter((p) => p.roleId === 'werewolf' && p.id !== player.id)
            .map((p) => ({ id: p.id, name: p.name, alive: p.alive }))
        : [];
    session.send('WW_SECRET', { roleId: player.roleId, teammates }, player.id);
  }

  function addLog(text) {
    state.logs.unshift(text);
    if (state.logs.length > 35) state.logs.pop();
  }

  function setBotSpeech(text, onDone) {
    state.botText = text;
    renderHost();
    syncStateToClients();
    window.AudioEngine.speak(text, onDone);
  }

  // ==================== ENTRY POINTS ====================
  function startHost(roomCode) {
    cleanup();
    isHost = true;
    autoRolesMode = true;
    demoCounter = 1;
    state = createInitialHostState(roomCode);

    session = window.RoomNetwork.createSession({
      gameType: 'werewolf',
      roomCode,
      isHost: true,
      onMessage: handleHostMessage,
      onStatus: (txt, ok) => updateNetBadge('ww-host-net-status', txt, ok)
    });

    bindHostEvents();
    renderHostShareBox();
    renderHost();
    window.AppUI.showView('view-werewolf-host');
  }

  function joinAsPlayer(roomCode, playerName) {
    cleanup();
    isHost = false;
    myName = playerName;
    clientSecret = null;
    witchInfo = null;
    seerResult = null;
    wolfPeersChoices = {};
    wolfConfirmedMap = {};
    cardRevealed = false;
    selectedNightTarget = null;
    lastReceivedSeq = -1;

    state = createInitialHostState(roomCode);

    const announceJoin = () => {
      if (!session || isHost) return;
      session.send('WW_JOIN', { name: myName });
    };

    session = window.RoomNetwork.createSession({
      gameType: 'werewolf',
      roomCode,
      isHost: false,
      onMessage: handleClientMessage,
      onStatus: (txt, ok) => updateNetBadge('ww-pl-net-status', txt, ok),
      onConnected: announceJoin
    });

    bindPlayerEvents();
    window.AppUI.showView('view-werewolf-player');
    renderPlayer();

    announceJoin();
    setTimeout(announceJoin, 900);
    setTimeout(announceJoin, 2400);
  }

  function cleanup() {
    clearHostTimers();
    window.AudioEngine.stopSpeech();
    if (session) {
      session.destroy();
      session = null;
    }
    state = null;
  }

  // ==================== HOST MESSAGE HANDLER ====================
  function handleHostMessage(msg) {
    if (!state) return;
    const { senderId, type, payload } = msg;

    if (type === 'WW_JOIN') {
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
            if (state.pendingHunterId === oldId) state.pendingHunterId = senderId;
            syncStateToClients();
            sendSecretToPlayer(byName);
            if (state.phase === 'NIGHT' && state.nightStep === 'witch' && byName.roleId === 'witch' && byName.alive) {
              sendWitchInfoTo(byName);
            }
          }
          return;
        }
        player = {
          id: senderId,
          name: cleanName,
          ready: false,
          alive: true,
          isDemo: false,
          roleId: null
        };
        state.players.push(player);
        if (autoRolesMode && state.players.length >= 5) {
          state.rolesConfig = getRecommendedWerewolfRoles(state.players.length);
        }
      } else if (state.phase === 'LOBBY') {
        player.name = cleanName;
      }

      syncStateToClients();
      if (state.phase !== 'LOBBY') {
        sendSecretToPlayer(player);
        if (state.phase === 'NIGHT' && state.nightStep === 'witch' && player.roleId === 'witch' && player.alive) {
          sendWitchInfoTo(player);
        }
      }
      renderHost();
      return;
    }

    if (type === 'WW_RENAME') {
      const p = state.players.find((x) => x.id === senderId);
      if (p && state.phase === 'LOBBY') {
        p.name = String(payload.name || p.name).trim().slice(0, 20) || p.name;
        syncStateToClients();
        renderHost();
      }
      return;
    }

    if (type === 'WW_READY') {
      const p = state.players.find((x) => x.id === senderId);
      if (p && state.phase === 'LOBBY') {
        p.ready = Boolean(payload.ready);
        syncStateToClients();
        renderHost();
      }
      return;
    }

    if (type === 'WW_LEAVE') {
      if (state.phase === 'LOBBY') {
        state.players = state.players.filter((x) => x.id !== senderId);
        if (autoRolesMode && state.players.length >= 5) {
          state.rolesConfig = getRecommendedWerewolfRoles(state.players.length);
        }
        syncStateToClients();
        renderHost();
      }
      return;
    }

    if (type === 'WW_DAY_VOTE' && state.phase === 'DAY') {
      const voter = state.players.find((x) => x.id === senderId && x.alive);
      if (!voter) return;
      const tId = payload.targetId;
      if (tId === '__skip__' || state.players.some((x) => x.id === tId && x.alive)) {
        state.dayVotes[senderId] = tId;
        syncStateToClients();
        renderHost();
        checkAllAlivePlayersVoted();
      }
      return;
    }

    if (type === 'WW_ACTION') {
      handleHostNightOrHunterAction(senderId, payload);
    }
  }

  function checkAllAlivePlayersVoted() {
    if (voteAllAnnounced || !state || state.phase !== 'DAY') return;
    const realAlive = state.players.filter((p) => p.alive && !p.isDemo);
    if (realAlive.length === 0) return;
    const allDone = realAlive.every((p) => Boolean(state.dayVotes[p.id]));
    if (allDone) {
      voteAllAnnounced = true;
      window.AudioEngine.playVoteGavel();
      const tally = getDayVoteTally();
      if (tally.leaderId && tally.leaderId !== '__skip__' && !tally.isTie) {
        const leader = state.players.find((p) => p.id === tally.leaderId);
        setBotSpeech(
          `Tất cả mọi người đã bỏ phiếu xong! ${leader ? leader.name : ''} đang dẫn đầu với ${tally.topVotes} phiếu. Mời ấn chốt kết quả trên màn hình chính.`
        );
      } else {
        setBotSpeech('Tất cả mọi người đã bỏ phiếu xong! Phiếu đang hòa hoặc bỏ trắng, mời ấn chốt trên màn hình chính.');
      }
    }
  }

  // ==================== HOST GAME LOGIC ====================
  function startNewGame() {
    if (!isHost || !state) return;
    window.AudioEngine.unlock();
    clearHostTimers();

    const pool = [];
    for (const [roleId, count] of Object.entries(state.rolesConfig)) {
      for (let i = 0; i < count; i++) pool.push(roleId);
    }
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    state.players.forEach((p, idx) => {
      p.roleId = pool[idx];
      p.alive = true;
    });

    state.phase = 'ROLE_REVEAL';
    state.nightNumber = 0;
    state.nightStep = null;
    state.lastGuardedId = null;
    state.witchPotions = { save: true, poison: true };
    state.dayVotes = {};
    state.pendingHunterId = null;
    state.winner = null;
    state.logs = [];
    state.lastDawnSummary = '';
    voteAllAnnounced = false;

    addLog('Ván chơi Ma Sói mới bắt đầu!');
    syncStateToClients();
    state.players.forEach((p) => {
      if (!p.isDemo) sendSecretToPlayer(p);
    });
    renderHost();

    setBotSpeech(
      'Trò chơi Ma Sói bắt đầu! Mọi người hãy chạm vào thẻ bài trên điện thoại để xem vai trò bí mật của mình nhé.',
      () => {
        hostStepTimer = setTimeout(() => {
          if (state && state.phase === 'ROLE_REVEAL') {
            beginNextNight();
          }
        }, 4200);
      }
    );
  }

  function beginNextNight() {
    clearHostTimers();
    state.phase = 'NIGHT';
    state.nightNumber += 1;
    state.nightStep = null;
    state.dayVotes = {};
    voteAllAnnounced = false;
    stepResolved = false;
    state.nightActions = {
      guardTarget: null,
      wolfVotes: {},
      wolfConfirmed: {},
      wolfTarget: null,
      seerTarget: null,
      witchSave: false,
      witchPoisonTarget: null
    };

    window.AudioEngine.playNightAmbience();
    renderHost();
    syncStateToClients();

    setBotSpeech(
      `Đêm thứ ${state.nightNumber}. Trời tối rồi, xin mời tất cả mọi người nhắm mắt lại!`,
      () => {
        hostStepTimer = setTimeout(() => advanceNightStep(), 1000);
      }
    );
  }

  function getActiveNightOrder() {
    const order = [];
    if ((state.rolesConfig.guard || 0) > 0) order.push('guard');
    order.push('werewolf');
    if ((state.rolesConfig.seer || 0) > 0) order.push('seer');
    if ((state.rolesConfig.witch || 0) > 0) order.push('witch');
    return order;
  }

  function advanceNightStep() {
    clearHostTimers();
    if (!state || state.phase !== 'NIGHT') return;

    const order = getActiveNightOrder();
    const currentIndex = state.nightStep ? order.indexOf(state.nightStep) : -1;
    const nextStep = order[currentIndex + 1];

    if (!nextStep) {
      resolveNightAndStartDay();
      return;
    }

    state.nightStep = nextStep;
    stepResolved = false;
    syncStateToClients();
    renderHost();

    if (nextStep === 'guard') runGuardStep();
    else if (nextStep === 'werewolf') runWerewolfStep();
    else if (nextStep === 'seer') runSeerStep();
    else if (nextStep === 'witch') runWitchStep();
  }

  function runGuardStep() {
    const aliveGuard = state.players.find((p) => p.alive && p.roleId === 'guard');
    setBotSpeech('Bảo Vệ ơi, hãy mở mắt dậy và chọn một người để bảo vệ đêm nay.', () => {
      if (!aliveGuard) {
        hostStepTimer = setTimeout(() => finishGuardStep(null), 5000 + Math.random() * 2000);
      } else if (aliveGuard.isDemo) {
        const candidates = state.players.filter((p) => p.alive && p.id !== state.lastGuardedId);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        hostStepTimer = setTimeout(() => finishGuardStep(pick ? pick.id : null), 1600);
      }
    });
  }

  function finishGuardStep(targetId) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'guard') return;
    stepResolved = true;
    clearHostTimers();
    state.nightActions.guardTarget = targetId;
    state.lastGuardedId = targetId;
    setBotSpeech('Bảo Vệ đã chọn xong. Xin mời Bảo Vệ nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function runWerewolfStep() {
    window.AudioEngine.playWolfHowl();
    const aliveWolves = state.players.filter((p) => p.alive && p.roleId === 'werewolf');
    setBotSpeech('Ma Sói ơi, hãy mở mắt dậy và chọn con mồi đêm nay!', () => {
      if (aliveWolves.length > 0 && aliveWolves.every((w) => w.isDemo)) {
        const prey = state.players.filter((p) => p.alive && p.roleId !== 'werewolf');
        const pick = prey[Math.floor(Math.random() * prey.length)];
        hostStepTimer = setTimeout(() => finishWerewolfStep(pick ? pick.id : null), 1800);
      }
    });
  }

  function pickMajorityWolfTarget(lastTargetId) {
    const tally = {};
    Object.values(state.nightActions.wolfVotes || {}).forEach((tId) => {
      if (tId) tally[tId] = (tally[tId] || 0) + 1;
    });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : lastTargetId;
  }

  function finishWerewolfStep(targetId) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'werewolf') return;
    stepResolved = true;
    clearHostTimers();
    state.nightActions.wolfTarget = targetId;
    setBotSpeech('Ma Sói đã chọn xong con mồi. Xin mời Ma Sói nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function runSeerStep() {
    const aliveSeer = state.players.find((p) => p.alive && p.roleId === 'seer');
    setBotSpeech('Tiên Tri ơi, hãy mở mắt dậy và chọn một người để soi thân phận.', () => {
      if (!aliveSeer) {
        hostStepTimer = setTimeout(() => finishSeerStep(), 5000 + Math.random() * 2000);
      } else if (aliveSeer.isDemo) {
        hostStepTimer = setTimeout(() => finishSeerStep(), 1600);
      }
    });
  }

  function finishSeerStep() {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'seer') return;
    stepResolved = true;
    clearHostTimers();
    setBotSpeech('Tiên Tri đã soi xong. Xin mời Tiên Tri nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function sendWitchInfoTo(witchPlayer) {
    const victimId = state.witchPotions.save ? state.nightActions.wolfTarget : null;
    const victim = victimId ? state.players.find((p) => p.id === victimId) : null;
    session.send(
      'WW_WITCH_INFO',
      {
        victimId: victim ? victim.id : null,
        victimName: victim ? victim.name : null,
        canSave: state.witchPotions.save,
        canPoison: state.witchPotions.poison
      },
      witchPlayer.id
    );
  }

  function runWitchStep() {
    window.AudioEngine.playWitchPotion();
    const aliveWitch = state.players.find((p) => p.alive && p.roleId === 'witch');
    if (aliveWitch && !aliveWitch.isDemo) {
      sendWitchInfoTo(aliveWitch);
    }
    setBotSpeech('Phù Thủy ơi, hãy mở mắt dậy để sử dụng bình thuốc của mình.', () => {
      if (!aliveWitch) {
        hostStepTimer = setTimeout(() => finishWitchStep(false, null), 5000 + Math.random() * 2000);
      } else if (aliveWitch.isDemo) {
        hostStepTimer = setTimeout(() => finishWitchStep(false, null), 1600);
      }
    });
  }

  function finishWitchStep(useSave, poisonTargetId) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'witch') return;
    stepResolved = true;
    clearHostTimers();
    if (useSave && state.witchPotions.save) {
      state.nightActions.witchSave = true;
      state.witchPotions.save = false;
    }
    if (poisonTargetId && state.witchPotions.poison) {
      state.nightActions.witchPoisonTarget = poisonTargetId;
      state.witchPotions.poison = false;
    }
    setBotSpeech('Phù Thủy đã hành động xong. Xin mời Phù Thủy nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function handleHostNightOrHunterAction(senderId, payload) {
    const player = state.players.find((p) => p.id === senderId);
    if (!player) return;

    if (state.phase === 'NIGHT') {
      if (state.nightStep === 'guard' && payload.step === 'guard' && player.alive && player.roleId === 'guard') {
        finishGuardStep(payload.targetId || null);
        return;
      }

      if (state.nightStep === 'werewolf' && payload.step === 'werewolf' && player.alive && player.roleId === 'werewolf') {
        state.nightActions.wolfVotes[senderId] = payload.targetId;
        if (payload.confirm) state.nightActions.wolfConfirmed[senderId] = true;

        const aliveWolves = state.players.filter((p) => p.alive && p.roleId === 'werewolf' && !p.isDemo);
        aliveWolves.forEach((w) => {
          session.send(
            'WW_WOLF_SYNC',
            {
              wolfVotes: state.nightActions.wolfVotes,
              wolfConfirmed: state.nightActions.wolfConfirmed
            },
            w.id
          );
        });

        if (payload.confirm) {
          const allConfirmed = aliveWolves.every((w) => Boolean(state.nightActions.wolfConfirmed[w.id]));
          if (allConfirmed || aliveWolves.length === 1) {
            finishWerewolfStep(pickMajorityWolfTarget(payload.targetId));
          }
        }
        return;
      }

      if (state.nightStep === 'seer' && payload.step === 'seer' && player.alive && player.roleId === 'seer') {
        if (payload.action === 'inspect' && payload.targetId) {
          const target = state.players.find((p) => p.id === payload.targetId);
          if (target) {
            session.send(
              'WW_SEER_RESULT',
              {
                targetId: target.id,
                targetName: target.name,
                isWolf: target.roleId === 'werewolf'
              },
              player.id
            );
          }
        } else if (payload.action === 'done') {
          finishSeerStep();
        }
        return;
      }

      if (state.nightStep === 'witch' && payload.step === 'witch' && player.alive && player.roleId === 'witch') {
        finishWitchStep(Boolean(payload.useSave), payload.poisonTargetId || null);
        return;
      }
    }

    if (state.phase === 'HUNTER_REVENGE' && payload.step === 'hunter' && senderId === state.pendingHunterId) {
      resolveHunterShot(payload.targetId || null);
    }
  }

  function resolveNightAndStartDay() {
    clearHostTimers();
    const { guardTarget, wolfTarget, witchSave, witchPoisonTarget } = state.nightActions;

    const deadIds = [];
    if (wolfTarget && wolfTarget !== guardTarget && !witchSave) {
      deadIds.push(wolfTarget);
    }
    if (witchPoisonTarget && !deadIds.includes(witchPoisonTarget)) {
      deadIds.push(witchPoisonTarget);
    }

    const deadPlayers = [];
    deadIds.forEach((id) => {
      const p = state.players.find((x) => x.id === id);
      if (p && p.alive) {
        p.alive = false;
        deadPlayers.push(p);
      }
    });

    window.AudioEngine.playRoosterDawn();

    let announcement = '';
    if (deadPlayers.length === 0) {
      announcement = `Trời sáng rồi, xin mời mọi người mở mắt ra! Đêm qua là một đêm bình yên, không có ai thiệt mạng.`;
      state.lastDawnSummary = '☀️ Đêm qua bình yên — Không có ai thiệt mạng.';
      addLog(`Ngày ${state.nightNumber}: Đêm qua bình yên.`);
    } else {
      const names = deadPlayers.map((p) => p.name).join(', ');
      announcement = `Trời sáng rồi, xin mời mọi người mở mắt ra! Đêm qua có ${deadPlayers.length} người đã thiệt mạng, đó là: ${names}!`;
      state.lastDawnSummary = `💀 Đêm qua có ${deadPlayers.length} người thiệt mạng: ${names}.`;
      addLog(`Ngày ${state.nightNumber}: ${names} đã thiệt mạng trong đêm.`);
    }

    const deadHunter = deadPlayers.find((p) => p.roleId === 'hunter');

    if (deadHunter) {
      state.phase = 'HUNTER_REVENGE';
      state.pendingHunterId = deadHunter.id;
      state.pendingHunterNext = 'DAY';
      syncStateToClients();
      renderHost();
      setBotSpeech(announcement, () => {
        triggerHunterPrompt(deadHunter);
      });
    } else {
      state.phase = 'DAY';
      state.dayVotes = {};
      voteAllAnnounced = false;
      syncStateToClients();
      renderHost();
      setBotSpeech(announcement, () => {
        checkWinCondition();
      });
    }
  }

  function triggerHunterPrompt(hunter) {
    setBotSpeech(
      `Khoan đã! ${hunter.name} là Thợ Săn. Xin mời ${hunter.name} hô bắn ở ngoài rồi bấm chọn tên người bị bắn ngay trên điện thoại của mình!`,
      () => {
        if (hunter.isDemo) {
          hostStepTimer = setTimeout(() => resolveHunterShot(null), 1800);
        }
      }
    );
  }

  function resolveHunterShot(targetId) {
    clearHostTimers();
    if (!state || state.phase !== 'HUNTER_REVENGE') return;
    const hunter = state.players.find((p) => p.id === state.pendingHunterId);
    const nextAfter = state.pendingHunterNext;
    state.pendingHunterId = null;
    state.pendingHunterNext = null;

    if (targetId) {
      const target = state.players.find((p) => p.id === targetId && p.alive);
      if (target) {
        target.alive = false;
        window.AudioEngine.playHunterShot();
        addLog(`🏹 Thợ Săn ${hunter ? hunter.name : ''} đã bắn hạ ${target.name}!`);
        state.lastDawnSummary += ` 🏹 Thợ Săn bắn hạ ${target.name}.`;
        syncStateToClients();
        renderHost();
        setBotSpeech(`Đoàng! Thợ Săn ${hunter ? hunter.name : ''} đã bắn hạ ${target.name} trước khi ngã xuống!`, () => {
          afterHunterResolved(nextAfter);
        });
        return;
      }
    }

    syncStateToClients();
    renderHost();
    setBotSpeech(`Thợ Săn ${hunter ? hunter.name : ''} quyết định không bắn ai.`, () => {
      afterHunterResolved(nextAfter);
    });
  }

  function afterHunterResolved(nextAfter) {
    if (checkWinCondition()) return;
    if (nextAfter === 'NEXT_NIGHT') {
      beginNextNight();
    } else {
      state.phase = 'DAY';
      state.dayVotes = {};
      voteAllAnnounced = false;
      syncStateToClients();
      renderHost();
    }
  }

  function lynchPlayer(targetId) {
    clearHostTimers();
    const target = state.players.find((p) => p.id === targetId && p.alive);
    if (!target) return;

    window.AudioEngine.playVoteGavel();
    target.alive = false;
    state.dayVotes = {};
    addLog(`⚖️ Cả làng đã biểu quyết treo cổ ${target.name}.`);

    if (target.roleId === 'hunter') {
      state.phase = 'HUNTER_REVENGE';
      state.pendingHunterId = target.id;
      state.pendingHunterNext = 'NEXT_NIGHT';
      syncStateToClients();
      renderHost();
      setBotSpeech(`Cả làng đã biểu quyết treo cổ ${target.name}!`, () => {
        triggerHunterPrompt(target);
      });
      return;
    }

    syncStateToClients();
    renderHost();
    setBotSpeech(`Cả làng đã biểu quyết treo cổ ${target.name}!`, () => {
      if (!checkWinCondition()) {
        hostStepTimer = setTimeout(() => beginNextNight(), 1400);
      }
    });
  }

  function skipLynchToNight() {
    clearHostTimers();
    window.AudioEngine.playVoteGavel();
    state.dayVotes = {};
    addLog(`🤝 Ngày ${state.nightNumber}: Hòa phiếu, không ai bị treo cổ.`);
    setBotSpeech('Hôm nay không có ai bị treo cổ. Màn đêm lại chuẩn bị buông xuống...', () => {
      hostStepTimer = setTimeout(() => beginNextNight(), 1100);
    });
  }

  function checkWinCondition() {
    const aliveWolves = state.players.filter((p) => p.alive && p.roleId === 'werewolf').length;
    const aliveVillagers = state.players.filter((p) => p.alive && p.roleId !== 'werewolf').length;

    let winner = null;
    if (aliveWolves === 0) winner = 'villager';
    else if (aliveWolves >= aliveVillagers) winner = 'werewolf';

    if (!winner) return false;

    clearHostTimers();
    state.phase = 'GAME_OVER';
    state.winner = winner;
    window.AudioEngine.playVictory();
    const winMsg =
      winner === 'villager'
        ? 'Chúc mừng Phe Dân Làng đã chiến thắng! Toàn bộ Ma Sói đã bị tiêu diệt!'
        : 'Ma Sói đã chiếm quyền kiểm soát ngôi làng! Phe Ma Sói chiến thắng!';
    addLog(`🏆 ${winMsg}`);
    syncStateToClients();
    renderHost();
    setBotSpeech(winMsg);
    return true;
  }

  function getDayVoteTally() {
    const groups = {}; // targetId -> [voterName]
    Object.entries(state.dayVotes || {}).forEach(([vId, tId]) => {
      const voter = state.players.find((p) => p.id === vId);
      if (!voter || !voter.alive) return;
      if (!groups[tId]) groups[tId] = [];
      groups[tId].push(voter.name);
    });

    const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    const topVotes = entries[0] ? entries[0][1].length : 0;
    const isTie = entries.length > 1 && entries[1][1].length === topVotes;
    const leaderId = entries[0] ? entries[0][0] : null;
    return { groups, entries, topVotes, isTie, leaderId };
  }

  // ==================== CLIENT MESSAGE HANDLER ====================
  function handleClientMessage(msg) {
    if (!state) return;
    const { type, payload } = msg;

    if (type === 'WW_STATE') {
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

      const prevStep = state.nightStep;
      const prevPhase = state.phase;
      state = { ...state, ...payload };

      if (state.phase === 'LOBBY') {
        clientSecret = null;
        witchInfo = null;
        seerResult = null;
        wolfPeersChoices = {};
        wolfConfirmedMap = {};
        cardRevealed = false;
      }

      if (state.phase === 'NIGHT' && (prevPhase !== 'NIGHT' || prevStep !== state.nightStep)) {
        selectedNightTarget = null;
        witchSaveChoice = false;
        witchPoisonChoice = null;
        seerResult = null;
        wolfPeersChoices = {};
        wolfConfirmedMap = {};

        if (clientSecret && state.nightStep === clientSecret.roleId && isMeAlive() && 'vibrate' in navigator) {
          try {
            navigator.vibrate([120, 60, 120]);
          } catch (_) {}
        }
      }

      if (state.phase === 'HUNTER_REVENGE' && state.pendingHunterId === session.clientId && 'vibrate' in navigator) {
        try {
          navigator.vibrate([180, 80, 180]);
        } catch (_) {}
      }

      renderPlayer();
      return;
    }

    if (type === 'WW_SECRET') {
      clientSecret = payload;
      renderPlayer();
      return;
    }

    if (type === 'WW_WITCH_INFO') {
      witchInfo = payload;
      renderPlayer();
      return;
    }

    if (type === 'WW_SEER_RESULT') {
      seerResult = payload;
      renderPlayer();
      return;
    }

    if (type === 'WW_WOLF_SYNC') {
      wolfPeersChoices = payload.wolfVotes || {};
      wolfConfirmedMap = payload.wolfConfirmed || {};
      renderPlayer();
    }
  }

  function isMeAlive() {
    if (!state || !session) return false;
    const me = state.players.find((p) => p.id === session.clientId);
    return me ? me.alive : false;
  }

  // ==================== HOST UI & EVENTS ====================
  function bindHostEvents() {
    document.getElementById('ww-host-copy-link').onclick = () => {
      const url = window.RoomNetwork.buildShareUrl('werewolf', state.roomCode);
      window.AppUI.copyText(url, 'Đã copy link mời phòng Ma Sói!');
    };

    document.getElementById('ww-host-test-voice').onclick = () => {
      window.AudioEngine.unlock();
      window.AudioEngine.speak('Xin chào cả hội! Bot Quản Trò đã sẵn sàng dẫn dắt ván Ma Sói hôm nay.');
    };

    document.getElementById('ww-host-leave').onclick = () => {
      cleanup();
      window.AppUI.goHome();
    };

    document.getElementById('ww-host-add-demo').onclick = () => {
      if (!state || state.phase !== 'LOBBY') return;
      const demoNames = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc'];
      const name = `${demoNames[(demoCounter - 1) % demoNames.length]} (Test ${demoCounter})`;
      demoCounter += 1;
      state.players.push({
        id: `demo_${Date.now()}_${demoCounter}`,
        name,
        ready: true,
        alive: true,
        isDemo: true,
        roleId: null
      });
      if (autoRolesMode && state.players.length >= 5) {
        state.rolesConfig = getRecommendedWerewolfRoles(state.players.length);
      }
      syncStateToClients();
      renderHost();
    };

    document.getElementById('ww-host-auto-roles').onclick = () => {
      autoRolesMode = true;
      state.rolesConfig = getRecommendedWerewolfRoles(Math.max(5, state.players.length));
      syncStateToClients();
      renderHost();
    };

    document.getElementById('ww-host-start-btn').onclick = () => startNewGame();

    document.getElementById('ww-host-skip-step').onclick = () => {
      if (!state || state.phase !== 'NIGHT') return;
      if (state.nightStep === 'guard') finishGuardStep(null);
      else if (state.nightStep === 'werewolf') {
        const prey = state.players.find((p) => p.alive && p.roleId !== 'werewolf');
        finishWerewolfStep(pickMajorityWolfTarget(prey ? prey.id : null));
      } else if (state.nightStep === 'seer') finishSeerStep();
      else if (state.nightStep === 'witch') finishWitchStep(false, null);
    };

    document.getElementById('ww-host-skip-hunter').onclick = () => resolveHunterShot(null);

    document.getElementById('ww-host-finalize-vote').onclick = async () => {
      if (!state || state.phase !== 'DAY') return;
      const tally = getDayVoteTally();
      if (!tally.leaderId) return;
      if (tally.isTie || tally.leaderId === '__skip__') {
        const ok = await window.AppUI.confirmDialog(
          'Hòa phiếu / Bỏ phiếu trắng?',
          'Kết quả hiện tại không có người bị treo cổ. Chuyển sang Đêm tiếp theo?'
        );
        if (ok) skipLynchToNight();
        return;
      }
      const leader = state.players.find((p) => p.id === tally.leaderId);
      if (!leader) return;
      const ok = await window.AppUI.confirmDialog(
        'Chốt treo cổ theo phiếu bầu?',
        `Treo cổ ${leader.name} (${tally.topVotes} phiếu)?`
      );
      if (ok) lynchPlayer(leader.id);
    };

    document.getElementById('ww-host-no-lynch').onclick = async () => {
      const ok = await window.AppUI.confirmDialog(
        'Xác nhận hòa phiếu?',
        'Không treo cổ ai hôm nay và chuyển sang đêm tiếp theo?'
      );
      if (ok) skipLynchToNight();
    };

    document.getElementById('ww-host-play-again').onclick = () => {
      clearHostTimers();
      state.phase = 'LOBBY';
      state.nightNumber = 0;
      state.nightStep = null;
      state.dayVotes = {};
      state.winner = null;
      state.players.forEach((p) => {
        p.alive = true;
        p.roleId = null;
        if (!p.isDemo) p.ready = false;
      });
      syncStateToClients();
      renderHost();
    };
  }

  function renderHostShareBox() {
    document.getElementById('ww-host-code').textContent = state.roomCode;
    const shareUrl = window.RoomNetwork.buildShareUrl('werewolf', state.roomCode);
    document.getElementById('ww-host-share-url').textContent = shareUrl;
    window.AppUI.renderQrCode(document.getElementById('ww-host-qr'), shareUrl);
  }

  function renderHost() {
    if (!state) return;
    const lobbyEl = document.getElementById('ww-host-lobby');
    const gameEl = document.getElementById('ww-host-game');

    if (state.phase === 'LOBBY') {
      lobbyEl.hidden = false;
      gameEl.hidden = true;
      renderHostLobby();
    } else {
      lobbyEl.hidden = true;
      gameEl.hidden = false;
      renderHostActiveGame();
    }
  }

  function renderHostLobby() {
    const count = state.players.length;
    const readyCount = state.players.filter((p) => p.ready).length;
    document.getElementById('ww-host-player-count').textContent = String(count);
    document.getElementById('ww-host-ready-summary').textContent = `${readyCount}/${count} sẵn sàng`;

    const listEl = document.getElementById('ww-host-player-list');
    listEl.innerHTML = '';
    if (count === 0) {
      const empty = document.createElement('li');
      empty.className = 'player-item';
      empty.textContent = 'Chưa có ai vào phòng. Hãy quét QR hoặc nhập mã phòng trên điện thoại.';
      listEl.appendChild(empty);
    } else {
      state.players.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'player-item';
        const left = document.createElement('span');
        left.className = 'player-name-wrap';
        left.textContent = p.name;

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.gap = '0.45rem';
        right.style.alignItems = 'center';

        const badge = document.createElement('span');
        badge.className = `pill ${p.ready ? 'pill-ready' : 'pill-wait'}`;
        badge.textContent = p.ready ? 'Sẵn sàng' : 'Đang chờ';

        const kickBtn = document.createElement('button');
        kickBtn.type = 'button';
        kickBtn.className = 'btn btn-ghost btn-sm';
        kickBtn.textContent = '✕';
        kickBtn.setAttribute('aria-label', `Xóa ${p.name}`);
        kickBtn.addEventListener('click', () => {
          state.players = state.players.filter((x) => x.id !== p.id);
          if (autoRolesMode && state.players.length >= 5) {
            state.rolesConfig = getRecommendedWerewolfRoles(state.players.length);
          }
          syncStateToClients();
          renderHost();
        });

        right.append(badge, kickBtn);
        li.append(left, right);
        listEl.appendChild(li);
      });
    }

    const configEl = document.getElementById('ww-host-role-config');
    configEl.innerHTML = '';
    const order = ['werewolf', 'seer', 'guard', 'witch', 'hunter', 'villager'];
    let totalRoles = 0;

    order.forEach((roleId) => {
      const role = WEREWOLF_ROLES[roleId];
      const val = state.rolesConfig[roleId] || 0;
      totalRoles += val;

      const row = document.createElement('div');
      row.className = 'role-config-row';

      const info = document.createElement('div');
      info.className = 'role-config-info';
      const icon = document.createElement('span');
      icon.textContent = role.icon;
      icon.setAttribute('aria-hidden', 'true');
      const txt = document.createElement('div');
      txt.innerHTML = `<strong>${escapeHtml(role.name)}</strong><small>${escapeHtml(role.teamName)}</small>`;
      info.append(icon, txt);

      const stepper = document.createElement('div');
      stepper.className = 'stepper';
      const minus = document.createElement('button');
      minus.type = 'button';
      minus.textContent = '−';
      minus.setAttribute('aria-label', `Giảm ${role.name}`);
      minus.addEventListener('click', () => {
        autoRolesMode = false;
        state.rolesConfig[roleId] = Math.max(0, (state.rolesConfig[roleId] || 0) - 1);
        syncStateToClients();
        renderHost();
      });

      const num = document.createElement('span');
      num.textContent = String(val);

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.textContent = '+';
      plus.setAttribute('aria-label', `Tăng ${role.name}`);
      plus.addEventListener('click', () => {
        autoRolesMode = false;
        const max = ['seer', 'guard', 'witch', 'hunter'].includes(roleId) ? 1 : 10;
        state.rolesConfig[roleId] = Math.min(max, (state.rolesConfig[roleId] || 0) + 1);
        syncStateToClients();
        renderHost();
      });

      stepper.append(minus, num, plus);
      row.append(info, stepper);
      configEl.appendChild(row);
    });

    const totalNote = document.getElementById('ww-host-role-total');
    const wolves = state.rolesConfig.werewolf || 0;
    const villagersSide = totalRoles - wolves;
    const canStart =
      count >= 5 && readyCount === count && totalRoles === count && wolves >= 1 && villagersSide > wolves;

    if (count < 5) {
      totalNote.textContent = `Tổng vai trò: ${totalRoles} (Cần tối thiểu 5 người chơi)`;
    } else if (totalRoles !== count) {
      totalNote.textContent = `⚠️ Tổng vai trò (${totalRoles}) chưa khớp số người chơi (${count})!`;
    } else if (wolves < 1 || villagersSide <= wolves) {
      totalNote.textContent = `⚠️ Cần ít nhất 1 Ma Sói và phe Dân nhiều hơn Ma Sói!`;
    } else if (readyCount < count) {
      totalNote.textContent = `✅ Đã khớp ${totalRoles} vai trò — Đang chờ ${count - readyCount} người ấn Sẵn sàng.`;
    } else {
      totalNote.textContent = `🎉 Đủ ${count} người sẵn sàng — Có thể bắt đầu ngay!`;
    }

    document.getElementById('ww-host-start-btn').disabled = !canStart;
  }

  function renderHostActiveGame() {
    const aliveCount = state.players.filter((p) => p.alive).length;
    const phaseMap = {
      ROLE_REVEAL: 'CHIA VAI TRÒ',
      NIGHT: `ĐÊM ${state.nightNumber}`,
      HUNTER_REVENGE: 'THỢ SĂN RA TAY',
      DAY: `NGÀY ${state.nightNumber}`,
      GAME_OVER: 'KẾT THÚC'
    };
    document.getElementById('ww-host-phase-badge').textContent = phaseMap[state.phase] || state.phase;
    document.getElementById('ww-host-alive-count').textContent = `Còn sống: ${aliveCount}/${state.players.length}`;
    document.getElementById('ww-host-bot-text').textContent = state.botText;

    const nightBox = document.getElementById('ww-host-night-box');
    const dayBox = document.getElementById('ww-host-day-box');
    const overBox = document.getElementById('ww-host-gameover-box');
    const hunterWait = document.getElementById('ww-host-hunter-wait');

    nightBox.hidden = !(state.phase === 'NIGHT' || state.phase === 'ROLE_REVEAL');
    dayBox.hidden = !(state.phase === 'DAY' || state.phase === 'HUNTER_REVENGE');
    overBox.hidden = state.phase !== 'GAME_OVER';
    hunterWait.hidden = state.phase !== 'HUNTER_REVENGE';

    if (state.phase === 'NIGHT' || state.phase === 'ROLE_REVEAL') {
      const stepsEl = document.getElementById('ww-host-night-steps');
      stepsEl.innerHTML = '';
      const order = getActiveNightOrder();
      const labels = {
        guard: '🛡️ Bảo Vệ thức dậy bảo vệ 1 người',
        werewolf: '🐺 Ma Sói thức dậy chọn con mồi',
        seer: '🔮 Tiên Tri thức dậy soi thân phận',
        witch: '🧪 Phù Thủy thức dậy dùng bình thuốc'
      };
      const curIdx = state.nightStep ? order.indexOf(state.nightStep) : -1;
      order.forEach((stepKey, idx) => {
        const li = document.createElement('li');
        li.className = 'night-step-item';
        if (state.phase === 'NIGHT') {
          if (idx < curIdx) li.classList.add('done');
          else if (idx === curIdx) li.classList.add('active');
        }
        li.innerHTML = `<span>${labels[stepKey]}</span><span>${
          state.phase === 'NIGHT' && idx === curIdx ? 'Đang chờ...' : idx < curIdx ? 'Xong' : ''
        }</span>`;
        stepsEl.appendChild(li);
      });
    }

    if (state.phase === 'DAY' || state.phase === 'HUNTER_REVENGE') {
      document.getElementById('ww-host-night-result-banner').textContent = state.lastDawnSummary;

      // Render Live Phone Vote Tally
      const tally = getDayVoteTally();
      const votedTotal = Object.keys(state.dayVotes || {}).length;
      document.getElementById('ww-host-vote-progress').textContent = `${votedTotal}/${aliveCount} đã vote`;

      const tallyEl = document.getElementById('ww-host-vote-tally');
      tallyEl.innerHTML = '';
      if (tally.entries.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'vote-tally-item';
        empty.textContent = 'Chưa có ai bấm Vote trên điện thoại (có thể bấm Vote trực tiếp hoặc vote miệng ở ngoài).';
        tallyEl.appendChild(empty);
      } else {
        tally.entries.forEach(([tId, voters]) => {
          const li = document.createElement('li');
          li.className = 'vote-tally-item';
          const targetName =
            tId === '__skip__' ? '🏳️ Bỏ phiếu trắng' : state.players.find((p) => p.id === tId)?.name || '?';
          li.innerHTML = `<span><strong>${escapeHtml(targetName)}</strong> <small>(${escapeHtml(
            voters.join(', ')
          )})</small></span><span class="pill pill-ready">${voters.length} phiếu</span>`;
          tallyEl.appendChild(li);
        });
      }

      const finalizeBtn = document.getElementById('ww-host-finalize-vote');
      finalizeBtn.hidden = !(state.phase === 'DAY' && tally.entries.length > 0);
      if (!finalizeBtn.hidden) {
        if (tally.isTie || tally.leaderId === '__skip__') {
          finalizeBtn.textContent = '🤝 Chốt theo phiếu: Hòa / Không treo cổ ai';
        } else {
          const leader = state.players.find((p) => p.id === tally.leaderId);
          finalizeBtn.textContent = `⚖️ Chốt treo cổ ${leader ? leader.name : ''} (${tally.topVotes} phiếu)`;
        }
      }

      // Direct manual lynch buttons
      const lynchGrid = document.getElementById('ww-host-lynch-grid');
      lynchGrid.innerHTML = '';
      const canLynch = state.phase === 'DAY';
      state.players
        .filter((p) => p.alive)
        .forEach((p) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'lynch-btn';
          btn.disabled = !canLynch;
          btn.textContent = `⚖️ Treo cổ ${p.name}`;
          btn.addEventListener('click', async () => {
            const ok = await window.AppUI.confirmDialog(
              'Xác nhận treo cổ?',
              `Xác nhận cả làng đã vote treo cổ ${p.name}?`
            );
            if (ok) lynchPlayer(p.id);
          });
          lynchGrid.appendChild(btn);
        });
      document.getElementById('ww-host-no-lynch').disabled = !canLynch;
    }

    if (state.phase === 'GAME_OVER') {
      const banner = document.getElementById('ww-host-winner-banner');
      banner.textContent =
        state.winner === 'villager' ? '🏆 PHE DÂN LÀNG CHIẾN THẮNG!' : '🐺 PHE MA SÓI CHIẾN THẮNG!';

      const revealEl = document.getElementById('ww-host-reveal-list');
      revealEl.innerHTML = '';
      state.players.forEach((p) => {
        const r = WEREWOLF_ROLES[p.roleId] || WEREWOLF_ROLES.villager;
        const li = document.createElement('li');
        li.className = 'reveal-item';
        li.innerHTML = `<span><strong>${escapeHtml(p.name)}</strong> (${p.alive ? 'Sống' : 'Đã chết'})</span><span>${r.icon} ${escapeHtml(r.name)}</span>`;
        revealEl.appendChild(li);
      });
    }

    const boardEl = document.getElementById('ww-host-board-players');
    boardEl.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = `board-player-tile ${p.alive ? '' : 'dead'}`;
      li.innerHTML = `<span>${escapeHtml(p.name)}</span><span class="pill ${p.alive ? 'pill-alive' : 'pill-dead'}">${
        p.alive ? 'Sống' : 'Chết'
      }</span>`;
      boardEl.appendChild(li);
    });

    const logEl = document.getElementById('ww-host-log-list');
    logEl.innerHTML = '';
    state.logs.forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      logEl.appendChild(li);
    });
  }

  // ==================== PLAYER UI & EVENTS ====================
  function bindPlayerEvents() {
    document.getElementById('ww-pl-leave').onclick = () => {
      if (session) session.send('WW_LEAVE', {});
      cleanup();
      window.AppUI.goHome();
    };

    document.getElementById('ww-pl-edit-name').onclick = async () => {
      const newName = await window.AppUI.promptNameDialog(myName);
      if (newName && newName !== myName) {
        myName = newName;
        if (session) session.send('WW_RENAME', { name: myName });
        renderPlayer();
      }
    };

    document.getElementById('ww-pl-ready-btn').onclick = () => {
      window.AudioEngine.unlock();
      const me = state.players.find((p) => p.id === session.clientId);
      const nextReady = me ? !me.ready : true;
      session.send('WW_READY', { ready: nextReady });
    };

    document.getElementById('ww-pl-toggle-card').onclick = () => {
      cardRevealed = !cardRevealed;
      renderSecretCard();
    };
  }

  function renderSecretCard() {
    const btn = document.getElementById('ww-pl-toggle-card');
    const bgLayer = document.getElementById('ww-pl-card-bg');
    const front = document.getElementById('ww-pl-card-front');
    const back = document.getElementById('ww-pl-card-back');
    btn.setAttribute('aria-expanded', String(cardRevealed));
    front.hidden = cardRevealed;
    back.hidden = !cardRevealed;

    if (clientSecret && clientSecret.roleId) {
      const role = WEREWOLF_ROLES[clientSecret.roleId];
      if (bgLayer && role.bgImage) {
        bgLayer.style.backgroundImage = `url('${role.bgImage}')`;
      }
      if (role.themeColor) {
        btn.style.setProperty('--role-theme', role.themeColor);
      }
      document.getElementById('ww-pl-role-icon').textContent = role.icon;
      document.getElementById('ww-pl-role-name').textContent = `${role.name} (${role.teamName})`;
      document.getElementById('ww-pl-role-desc').textContent = role.desc;

      const matesEl = document.getElementById('ww-pl-role-teammates');
      if (clientSecret.teammates && clientSecret.teammates.length > 0) {
        matesEl.hidden = false;
        matesEl.textContent = `Đồng bọn Ma Sói: ${clientSecret.teammates.map((m) => m.name).join(', ')}`;
      } else {
        matesEl.hidden = true;
      }
    }
  }

  function renderPlayer() {
    if (!state || !session) return;
    document.getElementById('ww-pl-room-code').textContent = state.roomCode;
    document.getElementById('ww-pl-my-name').textContent = myName;

    const lobbyEl = document.getElementById('ww-pl-lobby');
    const gameEl = document.getElementById('ww-pl-game');

    if (state.phase === 'LOBBY') {
      lobbyEl.hidden = false;
      gameEl.hidden = true;

      const me = state.players.find((p) => p.id === session.clientId);
      const readyBtn = document.getElementById('ww-pl-ready-btn');
      if (me && me.ready) {
        readyBtn.textContent = '⏳ Đã Sẵn Sàng (Ấn để hủy)';
        readyBtn.className = 'btn btn-secondary btn-lg btn-block';
      } else {
        readyBtn.textContent = '✅ Ấn Sẵn Sàng';
        readyBtn.className = 'btn btn-success btn-lg btn-block';
      }

      document.getElementById('ww-pl-count').textContent = String(state.players.length);
      const list = document.getElementById('ww-pl-lobby-list');
      list.innerHTML = '';
      state.players.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.innerHTML = `<span>${escapeHtml(p.name)}${p.id === session.clientId ? ' (Bạn)' : ''}</span><span class="pill ${
          p.ready ? 'pill-ready' : 'pill-wait'
        }">${p.ready ? 'Sẵn sàng' : 'Đang chờ'}</span>`;
        list.appendChild(li);
      });
      return;
    }

    lobbyEl.hidden = true;
    gameEl.hidden = false;
    renderSecretCard();

    const me = state.players.find((p) => p.id === session.clientId);
    const alive = me ? me.alive : false;
    const aliveBadge = document.getElementById('ww-pl-alive-badge');
    aliveBadge.textContent = alive ? '❤️ Còn sống' : '💀 Đã bị loại';
    aliveBadge.className = `alive-status-pill ${alive ? '' : 'dead'}`;

    const phaseMap = {
      ROLE_REVEAL: 'XEM VAI TRÒ',
      NIGHT: `🌙 ĐÊM ${state.nightNumber}`,
      HUNTER_REVENGE: '🏹 THỢ SĂN RA TAY',
      DAY: `☀️ NGÀY ${state.nightNumber}`,
      GAME_OVER: '🏆 KẾT THÚC'
    };
    document.getElementById('ww-pl-phase-badge').textContent = phaseMap[state.phase] || state.phase;

    renderPlayerActionArea(alive);

    const boardList = document.getElementById('ww-pl-board-list');
    boardList.innerHTML = '';
    state.players.forEach((p) => {
      const li = document.createElement('li');
      li.className = `player-item ${p.alive ? '' : 'dead'}`;
      const rName =
        state.phase === 'GAME_OVER' && p.roleId
          ? ` — ${WEREWOLF_ROLES[p.roleId]?.icon || ''} ${WEREWOLF_ROLES[p.roleId]?.name || ''}`
          : '';
      li.innerHTML = `<span>${escapeHtml(p.name)}${escapeHtml(rName)}</span><span class="pill ${
        p.alive ? 'pill-alive' : 'pill-dead'
      }">${p.alive ? 'Sống' : 'Chết'}</span>`;
      boardList.appendChild(li);
    });
  }

  function renderPlayerActionArea(alive) {
    const area = document.getElementById('ww-pl-action-area');
    area.innerHTML = '';

    if (state.phase === 'GAME_OVER') {
      const box = document.createElement('div');
      box.className = 'winner-banner';
      box.textContent =
        state.winner === 'villager' ? '🏆 PHE DÂN LÀNG CHIẾN THẮNG!' : '🐺 PHE MA SÓI CHIẾN THẮNG!';
      area.appendChild(box);
      return;
    }

    if (state.phase === 'HUNTER_REVENGE') {
      if (state.pendingHunterId === session.clientId) {
        const title = document.createElement('h3');
        title.textContent = '🏹 Bạn là Thợ Săn vừa ngã xuống!';
        area.appendChild(title);

        const guide = document.createElement('p');
        guide.className = 'panel-desc';
        guide.textContent =
          'Hãy hô bắn ở ngoài đời rồi bấm chọn tên người bạn vừa bắn bên dưới để Bot ghi nhận và tiếp tục ván chơi:';
        area.appendChild(guide);

        const grid = document.createElement('div');
        grid.className = 'target-grid';
        state.players
          .filter((p) => p.alive && p.id !== session.clientId)
          .forEach((p) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'target-btn';
            btn.textContent = `🎯 Bắn ${p.name}`;
            btn.addEventListener('click', () => {
              session.send('WW_ACTION', { step: 'hunter', targetId: p.id });
            });
            grid.appendChild(btn);
          });
        area.appendChild(grid);

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'btn btn-secondary btn-block';
        skipBtn.textContent = 'Không bắn ai';
        skipBtn.addEventListener('click', () => {
          session.send('WW_ACTION', { step: 'hunter', targetId: null });
        });
        area.appendChild(skipBtn);
      } else {
        area.innerHTML = `<div class="sleep-box"><span class="sleep-icon" aria-hidden="true">🏹</span><p>Đang chờ Thợ Săn hô bắn và bấm xác nhận trên điện thoại...</p></div>`;
      }
      return;
    }

    if (state.phase === 'ROLE_REVEAL') {
      area.innerHTML = `<div class="sleep-box"><span class="sleep-icon" aria-hidden="true">🃏</span><p>Chạm vào thẻ bài phía trên để xem vai trò của bạn. Đêm 1 sắp bắt đầu!</p></div>`;
      return;
    }

    if (state.phase === 'DAY') {
      const h = document.createElement('h3');
      h.textContent = '☀️ Ban ngày — Tranh luận & Vote';
      area.appendChild(h);

      const summary = document.createElement('p');
      summary.textContent = state.lastDawnSummary || 'Mọi người hãy thảo luận tự do!';
      area.appendChild(summary);

      if (!alive) {
        const deadNote = document.createElement('p');
        deadNote.className = 'hint';
        deadNote.textContent = '💀 Bạn đã bị loại — không thể bỏ phiếu.';
        area.appendChild(deadNote);
        return;
      }

      const voteLabel = document.createElement('p');
      voteLabel.className = 'panel-desc';
      voteLabel.textContent = 'Bầu chọn người nghi là Ma Sói (Bot sẽ cập nhật trực tiếp lên màn hình chính):';
      area.appendChild(voteLabel);

      const myVote = state.dayVotes ? state.dayVotes[session.clientId] : null;
      const grid = document.createElement('div');
      grid.className = 'target-grid';

      state.players
        .filter((p) => p.alive && p.id !== session.clientId)
        .forEach((p) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `target-btn ${myVote === p.id ? 'selected' : ''}`;
          btn.textContent = myVote === p.id ? `✓ Vote ${p.name}` : `⚖️ ${p.name}`;
          btn.addEventListener('click', () => {
            session.send('WW_DAY_VOTE', { targetId: p.id });
          });
          grid.appendChild(btn);
        });

      const skipVoteBtn = document.createElement('button');
      skipVoteBtn.type = 'button';
      skipVoteBtn.className = `target-btn ${myVote === '__skip__' ? 'selected' : ''}`;
      skipVoteBtn.textContent = myVote === '__skip__' ? '✓ Phiếu trắng' : '🏳️ Bỏ phiếu trắng';
      skipVoteBtn.addEventListener('click', () => {
        session.send('WW_DAY_VOTE', { targetId: '__skip__' });
      });
      grid.appendChild(skipVoteBtn);

      area.appendChild(grid);
      return;
    }

    // NIGHT PHASE
    if (!alive) {
      area.innerHTML = `<div class="sleep-box"><span class="sleep-icon" aria-hidden="true">💀</span><p>Bạn đã bị loại. Hãy giữ im lặng hoàn toàn và theo dõi ván đấu.</p></div>`;
      return;
    }

    const myRole = clientSecret?.roleId;
    if (!myRole || state.nightStep !== myRole) {
      area.innerHTML = `<div class="sleep-box"><span class="sleep-icon" aria-hidden="true">🌙</span><p>Đang trong đêm... Hãy nhắm mắt lại và lắng nghe Bot Quản Trò.</p></div>`;
      return;
    }

    if (myRole === 'guard') renderGuardActionUI(area);
    else if (myRole === 'werewolf') renderWerewolfActionUI(area);
    else if (myRole === 'seer') renderSeerActionUI(area);
    else if (myRole === 'witch') renderWitchActionUI(area);
  }

  function renderGuardActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🛡️ Lượt Bảo Vệ: Chọn 1 người để che chở đêm nay';
    area.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    state.players
      .filter((p) => p.alive)
      .forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `target-btn ${selectedNightTarget === p.id ? 'selected' : ''}`;
        const blocked = state.lastGuardedId === p.id;
        btn.disabled = blocked;
        btn.textContent = blocked ? `${p.name} (Đêm trước)` : p.name;
        btn.addEventListener('click', () => {
          selectedNightTarget = p.id;
          renderPlayer();
        });
        grid.appendChild(btn);
      });
    area.appendChild(grid);

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-primary btn-block';
    confirm.disabled = !selectedNightTarget;
    confirm.textContent = '🛡️ Xác nhận bảo vệ';
    confirm.addEventListener('click', () => {
      session.send('WW_ACTION', { step: 'guard', targetId: selectedNightTarget });
    });
    area.appendChild(confirm);
  }

  function renderWerewolfActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🐺 Lượt Ma Sói: Chọn nạn nhân đêm nay';
    area.appendChild(h);

    if (Object.keys(wolfPeersChoices).length > 0) {
      const info = document.createElement('p');
      info.className = 'hint';
      const summary = Object.entries(wolfPeersChoices)
        .map(([wId, tId]) => {
          const w = state.players.find((x) => x.id === wId);
          const t = state.players.find((x) => x.id === tId);
          const done = wolfConfirmedMap[wId] ? ' ✓' : '';
          return `${w ? w.name : '?'} chọn ${t ? t.name : '?'}${done}`;
        })
        .join(' • ');
      info.textContent = `Đồng đội: ${summary}`;
      area.appendChild(info);
    }

    const iConfirmed = Boolean(wolfConfirmedMap[session.clientId]);
    const grid = document.createElement('div');
    grid.className = 'target-grid';
    state.players
      .filter((p) => p.alive)
      .forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `target-btn ${selectedNightTarget === p.id ? 'selected' : ''}`;
        btn.disabled = iConfirmed;
        btn.textContent = p.name;
        btn.addEventListener('click', () => {
          selectedNightTarget = p.id;
          session.send('WW_ACTION', { step: 'werewolf', targetId: p.id, confirm: false });
          renderPlayer();
        });
        grid.appendChild(btn);
      });
    area.appendChild(grid);

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-danger btn-block';
    confirm.disabled = !selectedNightTarget || iConfirmed;
    confirm.textContent = iConfirmed ? '⏳ Đã chốt — Đang chờ Sói đồng đội...' : '🐺 Chốt cắn người này';
    confirm.addEventListener('click', () => {
      wolfConfirmedMap[session.clientId] = true;
      session.send('WW_ACTION', { step: 'werewolf', targetId: selectedNightTarget, confirm: true });
      renderPlayer();
    });
    area.appendChild(confirm);
  }

  function renderSeerActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🔮 Lượt Tiên Tri';
    area.appendChild(h);

    if (seerResult) {
      const resBox = document.createElement('div');
      resBox.className = 'alert-box';
      resBox.innerHTML = seerResult.isWolf
        ? `<strong>🐺 ${escapeHtml(seerResult.targetName)} thuộc PHE MA SÓI!</strong>`
        : `<strong>🧑‍🌾 ${escapeHtml(seerResult.targetName)} thuộc PHE DÂN LÀNG!</strong>`;
      area.appendChild(resBox);

      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'btn btn-primary btn-block';
      doneBtn.textContent = 'Đã xem xong — Nhắm mắt lại';
      doneBtn.addEventListener('click', () => {
        session.send('WW_ACTION', { step: 'seer', action: 'done' });
      });
      area.appendChild(doneBtn);
      return;
    }

    const pNote = document.createElement('p');
    pNote.className = 'panel-desc';
    pNote.textContent = 'Chọn 1 người để soi xem họ có phải Ma Sói hay không:';
    area.appendChild(pNote);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    state.players
      .filter((p) => p.alive && p.id !== session.clientId)
      .forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'target-btn';
        btn.textContent = `🔮 ${p.name}`;
        btn.addEventListener('click', () => {
          session.send('WW_ACTION', { step: 'seer', action: 'inspect', targetId: p.id });
        });
        grid.appendChild(btn);
      });
    area.appendChild(grid);
  }

  function renderWitchActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🧪 Lượt Phù Thủy';
    area.appendChild(h);

    const info = witchInfo || { victimId: null, victimName: null, canSave: false, canPoison: false };

    const saveBox = document.createElement('div');
    saveBox.className = 'result-banner';
    if (!info.canSave) {
      saveBox.textContent = '💚 Bình Cứu: Đã dùng hết ở đêm trước.';
    } else if (!info.victimName) {
      saveBox.textContent = '💚 Bình Cứu: Đêm nay không có nạn nhân nào bị Sói cắn.';
    } else {
      saveBox.innerHTML = `<p>Đêm nay <strong>${escapeHtml(info.victimName)}</strong> vừa bị Sói cắn!</p>`;
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = `btn btn-block ${witchSaveChoice ? 'btn-success' : 'btn-secondary'}`;
      saveBtn.textContent = witchSaveChoice ? `✅ Đã chọn CỨU ${info.victimName}` : `💚 Dùng Bình Cứu ${info.victimName}`;
      saveBtn.addEventListener('click', () => {
        witchSaveChoice = !witchSaveChoice;
        renderPlayer();
      });
      saveBox.appendChild(saveBtn);
    }
    area.appendChild(saveBox);

    const poisonWrap = document.createElement('div');
    if (!info.canPoison) {
      const pTxt = document.createElement('p');
      pTxt.className = 'hint';
      pTxt.textContent = '☠️ Bình Độc: Đã dùng hết ở đêm trước.';
      poisonWrap.appendChild(pTxt);
    } else {
      const pTxt = document.createElement('p');
      pTxt.textContent = '☠️ Bình Độc (tùy chọn): Chọn 1 người để đầu độc, hoặc bỏ qua:';
      poisonWrap.appendChild(pTxt);

      const grid = document.createElement('div');
      grid.className = 'target-grid';
      state.players
        .filter((p) => p.alive && p.id !== session.clientId)
        .forEach((p) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `target-btn ${witchPoisonChoice === p.id ? 'selected' : ''}`;
          btn.textContent = `☠️ ${p.name}`;
          btn.addEventListener('click', () => {
            witchPoisonChoice = witchPoisonChoice === p.id ? null : p.id;
            renderPlayer();
          });
          grid.appendChild(btn);
        });
      poisonWrap.appendChild(grid);
    }
    area.appendChild(poisonWrap);

    const doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-primary btn-block';
    doneBtn.textContent = '🧪 Xong lượt Phù Thủy — Nhắm mắt lại';
    doneBtn.addEventListener('click', () => {
      session.send('WW_ACTION', {
        step: 'witch',
        useSave: witchSaveChoice,
        poisonTargetId: witchPoisonChoice
      });
    });
    area.appendChild(doneBtn);
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
