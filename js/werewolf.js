// Game 1: Ma Sói v2.4 — 11 Vai Trò, Tắt Tiếng Sói Hú, QR & Avatar Lớn, Thẻ Bài 3D Nhấn & Giữ
window.WerewolfGame = (() => {
  const { WEREWOLF_ROLES, getRecommendedWerewolfRoles, getRandomAvatarId } = window.GameData;

  let session = null;
  let isHost = false;
  let myName = '';
  let myAvatarId = '';
  let state = null;
  let clientSecret = null; // { roleId, teammates: [], loverInfo: null }
  let witchInfo = null;
  let alphaInfo = null;
  let seerResult = null;
  let wolfPeersChoices = {}; // { wolfId: targetId }
  let wolfConfirmedMap = {}; // { wolfId: boolean }
  let cardRevealed = false;
  let lastReceivedSeq = -1;

  // Host-only timers & guards
  let hostStepTimer = null;
  let joinTimers = [];
  let stepResolved = false;
  let autoRolesMode = true;
  let demoCounter = 1;
  let selectedNightTarget = null;
  let selectedCupidTargets = [];
  let witchSaveChoice = false;
  let witchPoisonChoice = null;
  let voteAllAnnounced = false;

  function isWolfRole(roleId) {
    return roleId === 'werewolf' || roleId === 'alpha_wolf';
  }

  function getPlayerSide(roleId) {
    if (isWolfRole(roleId)) return 'werewolf';
    if (roleId === 'jester' || roleId === 'serial_killer') return roleId;
    return 'villager';
  }

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
      players: [], // { id, name, avatarId, ready, alive, isDemo, roleId (host-only) }
      rolesConfig: getRecommendedWerewolfRoles(5),
      lastGuardedId: null,
      seerHistory: [],
      lovers: [], // [id1, id2]
      alphaWolfConvertUsed: false,
      elderLivesMap: {},
      witchPotions: { save: true, poison: true },
      nightActions: {
        cupidTargets: [],
        guardTarget: null,
        wolfVotes: {},
        wolfConfirmed: {},
        wolfTarget: null,
        alphaConvert: false,
        seerTarget: null,
        seerInspected: false,
        witchSave: false,
        witchPoisonTarget: null,
        serialKillerTarget: null
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
      seerHistory: s.seerHistory || [],
      dayVotes: s.dayVotes,
      pendingHunterId: s.pendingHunterId,
      botText: s.botText,
      lastDawnSummary: s.lastDawnSummary,
      winner: s.winner,
      lovers: revealAll ? s.lovers || [] : [],
      alphaWolfConvertUsed: Boolean(s.alphaWolfConvertUsed),
      logs: s.logs,
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatarId: p.avatarId || 'boy_smile',
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
    if (!isHost || !session || !player || !player.roleId || player.isDemo) return;
    const teammates = isWolfRole(player.roleId)
      ? state.players
          .filter((p) => isWolfRole(p.roleId) && p.id !== player.id)
          .map((p) => ({ id: p.id, name: p.name, alive: p.alive }))
      : [];
    let loverInfo = null;
    if (Array.isArray(state.lovers) && state.lovers.length === 2 && state.lovers.includes(player.id)) {
      const partnerId = state.lovers.find((id) => id !== player.id);
      const partner = state.players.find((p) => p.id === partnerId);
      if (partner) {
        loverInfo = {
          id: partner.id,
          name: partner.name,
          alive: partner.alive,
          roleName: WEREWOLF_ROLES[partner.roleId]?.name || '?'
        };
      }
    }
    session.send('WW_SECRET', { roleId: player.roleId, teammates, loverInfo }, player.id);
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

  function joinAsPlayer(roomCode, playerName, playerAvatarId) {
    cleanup();
    isHost = false;
    myName = playerName;
    myAvatarId = playerAvatarId || window.AppUI.getSavedAvatarId();
    clientSecret = null;
    witchInfo = null;
    alphaInfo = null;
    seerResult = null;
    wolfPeersChoices = {};
    wolfConfirmedMap = {};
    cardRevealed = false;
    selectedNightTarget = null;
    selectedCupidTargets = [];
    lastReceivedSeq = -1;

    state = createInitialHostState(roomCode);

    const announceJoin = () => {
      if (!session || isHost) return;
      session.send('WW_JOIN', { name: myName, avatarId: myAvatarId });
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
    joinTimers.push(setTimeout(announceJoin, 900));
    joinTimers.push(setTimeout(announceJoin, 2400));
  }

  function cleanup() {
    clearHostTimers();
    joinTimers.forEach((t) => clearTimeout(t));
    joinTimers = [];
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
      const avatarId = payload.avatarId || getRandomAvatarId(state.players.length);
      let player = state.players.find((p) => p.id === senderId);
      if (!player) {
        if (state.phase !== 'LOBBY') {
          const byName = state.players.find(
            (p) => p.name.toLowerCase() === cleanName.toLowerCase() && !p.isDemo
          );
          if (byName) {
            const oldId = byName.id;
            byName.id = senderId;
            if (payload.avatarId) byName.avatarId = payload.avatarId;
            if (state.pendingHunterId === oldId) state.pendingHunterId = senderId;
            syncStateToClients();
            sendSecretToPlayer(byName);
            if (state.phase === 'NIGHT' && state.nightStep === 'witch' && byName.roleId === 'witch' && byName.alive) {
              sendWitchInfoTo(byName);
            }
            if (state.phase === 'NIGHT' && state.nightStep === 'alpha_wolf' && byName.roleId === 'alpha_wolf' && byName.alive) {
              sendAlphaInfoTo(byName);
            }
          }
          return;
        }
        player = {
          id: senderId,
          name: cleanName,
          avatarId,
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
        if (payload.avatarId) player.avatarId = payload.avatarId;
      }

      syncStateToClients();
      if (state.phase !== 'LOBBY') {
        sendSecretToPlayer(player);
        if (state.phase === 'NIGHT' && state.nightStep === 'witch' && player.roleId === 'witch' && player.alive) {
          sendWitchInfoTo(player);
        }
        if (state.phase === 'NIGHT' && state.nightStep === 'alpha_wolf' && player.roleId === 'alpha_wolf' && player.alive) {
          sendAlphaInfoTo(player);
        }
      }
      renderHost();
      return;
    }

    if (type === 'WW_RENAME') {
      const p = state.players.find((x) => x.id === senderId);
      if (p && state.phase === 'LOBBY') {
        p.name = String(payload.name || p.name).trim().slice(0, 20) || p.name;
        if (payload.avatarId) p.avatarId = payload.avatarId;
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

    state.elderLivesMap = {};
    state.players.forEach((p, idx) => {
      p.roleId = pool[idx];
      p.alive = true;
      if (p.roleId === 'elder') state.elderLivesMap[p.id] = 2;
    });

    state.phase = 'ROLE_REVEAL';
    state.nightNumber = 0;
    state.nightStep = null;
    state.lastGuardedId = null;
    state.seerHistory = [];
    state.lovers = [];
    state.alphaWolfConvertUsed = false;
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
      'Trò chơi Ma Sói bắt đầu! Mọi người hãy nhấn và giữ thẻ bài trên điện thoại để xem vai trò bí mật của mình nhé.',
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
      cupidTargets: [],
      guardTarget: null,
      wolfVotes: {},
      wolfConfirmed: {},
      wolfTarget: null,
      alphaConvert: false,
      seerTarget: null,
      seerInspected: false,
      witchSave: false,
      witchPoisonTarget: null,
      serialKillerTarget: null
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
    if (state.nightNumber === 1 && (state.rolesConfig.cupid || 0) > 0) order.push('cupid');
    if ((state.rolesConfig.guard || 0) > 0) order.push('guard');
    order.push('werewolf');
    if ((state.rolesConfig.alpha_wolf || 0) > 0 && !state.alphaWolfConvertUsed) order.push('alpha_wolf');
    if ((state.rolesConfig.seer || 0) > 0) order.push('seer');
    if ((state.rolesConfig.witch || 0) > 0) order.push('witch');
    if ((state.rolesConfig.serial_killer || 0) > 0) order.push('serial_killer');
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

    if (nextStep === 'cupid') runCupidStep();
    else if (nextStep === 'guard') runGuardStep();
    else if (nextStep === 'werewolf') runWerewolfStep();
    else if (nextStep === 'alpha_wolf') runAlphaWolfStep();
    else if (nextStep === 'seer') runSeerStep();
    else if (nextStep === 'witch') runWitchStep();
    else if (nextStep === 'serial_killer') runSerialKillerStep();
  }

  function runCupidStep() {
    const aliveCupid = state.players.find((p) => p.alive && p.roleId === 'cupid');
    setBotSpeech('Thần Tình Yêu ơi, hãy mở mắt dậy và chọn 2 người để ghép thành Cặp Đôi Tình Nhân!', () => {
      if (!aliveCupid) {
        hostStepTimer = setTimeout(() => finishCupidStep([]), 3200);
      } else if (aliveCupid.isDemo) {
        const pool = [...state.players].filter((p) => p.alive);
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const pair = pool.length >= 2 ? [pool[0].id, pool[1].id] : [];
        hostStepTimer = setTimeout(() => finishCupidStep(pair), 1600);
      }
    });
  }

  function finishCupidStep(targetIds) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'cupid') return;
    stepResolved = true;
    clearHostTimers();
    const valid = Array.isArray(targetIds)
      ? [...new Set(targetIds)].filter((id) => state.players.some((p) => p.id === id && p.alive)).slice(0, 2)
      : [];
    if (valid.length === 2) {
      state.lovers = valid;
      state.nightActions.cupidTargets = valid;
      valid.forEach((id) => {
        const lp = state.players.find((p) => p.id === id);
        if (lp) sendSecretToPlayer(lp);
      });
    }
    setBotSpeech('Thần Tình Yêu đã se duyên xong. Xin mời Thần Tình Yêu nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
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
    const aliveWolves = state.players.filter((p) => p.alive && isWolfRole(p.roleId));
    setBotSpeech('Ma Sói ơi, hãy mở mắt dậy và chọn con mồi đêm nay!', () => {
      if (aliveWolves.length > 0 && aliveWolves.every((w) => w.isDemo)) {
        const prey = state.players.filter((p) => p.alive && !isWolfRole(p.roleId));
        const pick = prey[Math.floor(Math.random() * prey.length)];
        hostStepTimer = setTimeout(() => finishWerewolfStep(pick ? pick.id : null), 1800);
      }
    });
  }

  function pickMajorityWolfTarget(lastTargetId) {
    const isValidPrey = (id) =>
      Boolean(id) && state.players.some((p) => p.id === id && p.alive && !isWolfRole(p.roleId));
    const tally = {};
    Object.values(state.nightActions.wolfVotes || {}).forEach((tId) => {
      if (isValidPrey(tId)) tally[tId] = (tally[tId] || 0) + 1;
    });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (sorted[0]) return sorted[0][0];
    return isValidPrey(lastTargetId) ? lastTargetId : null;
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

  function sendAlphaInfoTo(alphaPlayer) {
    const victimId = state.nightActions.wolfTarget;
    const victim = victimId ? state.players.find((p) => p.id === victimId) : null;
    session.send(
      'WW_ALPHA_INFO',
      {
        victimId: victim ? victim.id : null,
        victimName: victim ? victim.name : null,
        canConvert: !state.alphaWolfConvertUsed && Boolean(victim)
      },
      alphaPlayer.id
    );
  }

  function runAlphaWolfStep() {
    const aliveAlpha = state.players.find((p) => p.alive && p.roleId === 'alpha_wolf');
    if (aliveAlpha && !aliveAlpha.isDemo) {
      sendAlphaInfoTo(aliveAlpha);
    }
    setBotSpeech('Sói Đầu Đàn ơi, bạn có muốn dùng quyền Nguyền biến nạn nhân đêm nay thành Ma Sói không?', () => {
      if (!aliveAlpha || state.alphaWolfConvertUsed || !state.nightActions.wolfTarget) {
        hostStepTimer = setTimeout(() => finishAlphaWolfStep(false), 2600);
      } else if (aliveAlpha.isDemo) {
        hostStepTimer = setTimeout(() => finishAlphaWolfStep(false), 1600);
      }
    });
  }

  function finishAlphaWolfStep(convert) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'alpha_wolf') return;
    stepResolved = true;
    clearHostTimers();
    if (convert && !state.alphaWolfConvertUsed && state.nightActions.wolfTarget) {
      state.nightActions.alphaConvert = true;
    }
    setBotSpeech('Sói Đầu Đàn đã quyết định xong. Xin mời Sói Đầu Đàn nhắm mắt lại.', () => {
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
    let didSave = false;
    let didPoison = false;
    if (useSave && state.witchPotions.save) {
      state.nightActions.witchSave = true;
      state.witchPotions.save = false;
      didSave = true;
    }
    if (poisonTargetId && state.witchPotions.poison) {
      state.nightActions.witchPoisonTarget = poisonTargetId;
      state.witchPotions.poison = false;
      didPoison = true;
    }

    if (didSave && didPoison) {
      window.AudioEngine.playWitchSave();
      setTimeout(() => window.AudioEngine.playWitchPoison(), 600);
    } else if (didSave) {
      window.AudioEngine.playWitchSave();
    } else if (didPoison) {
      window.AudioEngine.playWitchPoison();
    }

    setBotSpeech('Phù Thủy đã hành động xong. Xin mời Phù Thủy nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function runSerialKillerStep() {
    const aliveSK = state.players.find((p) => p.alive && p.roleId === 'serial_killer');
    setBotSpeech('Sát Nhân Độc Hành ơi, hãy mở mắt dậy và chọn 1 mục tiêu để ám sát đêm nay.', () => {
      if (!aliveSK) {
        hostStepTimer = setTimeout(() => finishSerialKillerStep(null), 3500);
      } else if (aliveSK.isDemo) {
        const candidates = state.players.filter((p) => p.alive && p.id !== aliveSK.id);
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        hostStepTimer = setTimeout(() => finishSerialKillerStep(pick ? pick.id : null), 1600);
      }
    });
  }

  function finishSerialKillerStep(targetId) {
    if (stepResolved || !state || state.phase !== 'NIGHT' || state.nightStep !== 'serial_killer') return;
    stepResolved = true;
    clearHostTimers();
    state.nightActions.serialKillerTarget = targetId || null;
    setBotSpeech('Sát Nhân đã chọn xong mục tiêu. Xin mời Sát Nhân nhắm mắt lại.', () => {
      hostStepTimer = setTimeout(() => advanceNightStep(), 900);
    });
  }

  function handleHostNightOrHunterAction(senderId, payload) {
    const player = state.players.find((p) => p.id === senderId);
    if (!player) return;

    if (state.phase === 'NIGHT') {
      if (state.nightStep === 'cupid' && payload.step === 'cupid' && player.alive && player.roleId === 'cupid') {
        const list = Array.isArray(payload.targetIds) ? payload.targetIds : [];
        if (list.length !== 2 || list[0] === list[1]) return;
        finishCupidStep(list);
        return;
      }

      if (state.nightStep === 'guard' && payload.step === 'guard' && player.alive && player.roleId === 'guard') {
        const tId = payload.targetId || null;
        if (tId) {
          const guardTarget = state.players.find((p) => p.id === tId && p.alive);
          if (!guardTarget || tId === state.lastGuardedId) return;
        }
        finishGuardStep(tId);
        return;
      }

      if (state.nightStep === 'werewolf' && payload.step === 'werewolf' && player.alive && isWolfRole(player.roleId)) {
        const prey = state.players.find(
          (p) => p.id === payload.targetId && p.alive && !isWolfRole(p.roleId)
        );
        if (!prey) return;

        state.nightActions.wolfVotes[senderId] = prey.id;
        if (payload.confirm) state.nightActions.wolfConfirmed[senderId] = true;

        const aliveWolves = state.players.filter((p) => p.alive && isWolfRole(p.roleId) && !p.isDemo);
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
            finishWerewolfStep(pickMajorityWolfTarget(prey.id));
          }
        }
        return;
      }

      if (
        state.nightStep === 'alpha_wolf' &&
        payload.step === 'alpha_wolf' &&
        player.alive &&
        player.roleId === 'alpha_wolf'
      ) {
        finishAlphaWolfStep(Boolean(payload.convert));
        return;
      }

      if (state.nightStep === 'seer' && payload.step === 'seer' && player.alive && player.roleId === 'seer') {
        if (payload.action === 'inspect' && payload.targetId) {
          if (state.nightActions.seerInspected) return;
          if (!Array.isArray(state.seerHistory)) state.seerHistory = [];
          if (state.seerHistory.includes(payload.targetId)) return;
          const target = state.players.find(
            (p) => p.id === payload.targetId && p.alive && p.id !== senderId
          );
          if (target) {
            state.nightActions.seerInspected = true;
            state.nightActions.seerTarget = target.id;
            state.seerHistory.push(target.id);
            syncStateToClients();
            session.send(
              'WW_SEER_RESULT',
              {
                targetId: target.id,
                targetName: target.name,
                isWolf: isWolfRole(target.roleId)
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
        const wantSave = Boolean(payload.useSave);
        let poisonId = payload.poisonTargetId || null;
        if (poisonId) {
          const validPoison = state.players.find((p) => p.id === poisonId && p.alive && p.id !== senderId);
          if (!validPoison || (wantSave && poisonId === state.nightActions.wolfTarget)) {
            poisonId = null;
          }
        }
        finishWitchStep(wantSave, poisonId);
        return;
      }

      if (
        state.nightStep === 'serial_killer' &&
        payload.step === 'serial_killer' &&
        player.alive &&
        player.roleId === 'serial_killer'
      ) {
        const target = state.players.find((p) => p.id === payload.targetId && p.alive && p.id !== senderId);
        finishSerialKillerStep(target ? target.id : null);
        return;
      }
    }

    if (state.phase === 'HUNTER_REVENGE' && payload.step === 'hunter' && senderId === state.pendingHunterId) {
      let targetId = payload.targetId || null;
      if (targetId) {
        const validShot = state.players.find((p) => p.id === targetId && p.alive && p.id !== senderId);
        if (!validShot) return;
      }
      resolveHunterShot(targetId);
    }
  }

  function applyLoversChainDeath(newlyDeadList) {
    if (!Array.isArray(state.lovers) || state.lovers.length !== 2) return [];
    const chainDead = [];
    const [idA, idB] = state.lovers;
    const pA = state.players.find((p) => p.id === idA);
    const pB = state.players.find((p) => p.id === idB);
    if (!pA || !pB) return [];

    if (!pA.alive && pB.alive) {
      pB.alive = false;
      chainDead.push({ partner: pB, diedFor: pA });
    } else if (!pB.alive && pA.alive) {
      pA.alive = false;
      chainDead.push({ partner: pA, diedFor: pB });
    }
    chainDead.forEach(({ partner, diedFor }) => {
      newlyDeadList.push(partner);
      addLog(`💔 ${partner.name} đã chết theo người yêu ${diedFor.name} vì tình!`);
    });
    return chainDead;
  }

  function resolveNightAndStartDay() {
    clearHostTimers();
    const { guardTarget, wolfTarget, alphaConvert, witchSave, witchPoisonTarget, serialKillerTarget } =
      state.nightActions;

    const deadIds = [];
    let elderSurvivedHint = false;

    if (alphaConvert && wolfTarget && wolfTarget !== guardTarget) {
      const converted = state.players.find((p) => p.id === wolfTarget && p.alive);
      if (converted) {
        converted.roleId = 'werewolf';
        state.alphaWolfConvertUsed = true;
        addLog(`🩸 Đêm ${state.nightNumber}: Sói Đầu Đàn đã nguyền hóa 1 nạn nhân gia nhập bầy Sói!`);
        state.players.forEach((p) => {
          if (p.id === converted.id || isWolfRole(p.roleId)) {
            sendSecretToPlayer(p);
          }
        });
      }
    } else if (wolfTarget && wolfTarget !== guardTarget && !witchSave) {
      const wolfVictim = state.players.find((p) => p.id === wolfTarget && p.alive);
      if (wolfVictim && wolfVictim.roleId === 'elder' && (state.elderLivesMap[wolfVictim.id] || 0) > 1) {
        state.elderLivesMap[wolfVictim.id] = 1;
        elderSurvivedHint = true;
        addLog(`🧓 Ngày ${state.nightNumber}: Già Làng bị Sói cắn nhưng nhờ lớp giáp đầu tiên vẫn bình an!`);
      } else {
        deadIds.push(wolfTarget);
      }
    }

    if (witchPoisonTarget && !deadIds.includes(witchPoisonTarget)) {
      deadIds.push(witchPoisonTarget);
    }
    if (serialKillerTarget && serialKillerTarget !== guardTarget && !deadIds.includes(serialKillerTarget)) {
      deadIds.push(serialKillerTarget);
    }

    const deadPlayers = [];
    deadIds.forEach((id) => {
      const p = state.players.find((x) => x.id === id);
      if (p && p.alive) {
        p.alive = false;
        deadPlayers.push(p);
      }
    });

    const loverDeaths = applyLoversChainDeath(deadPlayers);

    window.AudioEngine.playRoosterDawn();

    let announcement = '';
    if (deadPlayers.length === 0) {
      announcement = `Trời sáng rồi, xin mời mọi người mở mắt ra! Đêm qua là một đêm bình yên, không có ai thiệt mạng.`;
      state.lastDawnSummary = elderSurvivedHint
        ? '☀️ Đêm qua bình yên (Có người vừa thoát chết trong gang tấc!).'
        : '☀️ Đêm qua bình yên — Không có ai thiệt mạng.';
      addLog(`Ngày ${state.nightNumber}: Đêm qua bình yên.`);
    } else {
      const names = deadPlayers.map((p) => p.name).join(', ');
      const loverExtra =
        loverDeaths.length > 0
          ? ` Trong đó ${loverDeaths.map((d) => `${d.partner.name} chết theo người yêu ${d.diedFor.name}`).join('; ')}.`
          : '';
      announcement = `Trời sáng rồi, xin mời mọi người mở mắt ra! Đêm qua có ${deadPlayers.length} người đã thiệt mạng, đó là: ${names}!${loverExtra}`;
      state.lastDawnSummary = `💀 Đêm qua có ${deadPlayers.length} người thiệt mạng: ${names}.${loverExtra}`;
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
        const chainList = [];
        const chained = applyLoversChainDeath(chainList);
        const chainMsg =
          chained.length > 0 ? ` ${chained.map((d) => `${d.partner.name} cũng chết theo vì tình!`).join(' ')}` : '';
        syncStateToClients();
        renderHost();
        setBotSpeech(
          `Đoàng! Thợ Săn ${hunter ? hunter.name : ''} đã bắn hạ ${target.name} trước khi ngã xuống!${chainMsg}`,
          () => {
            afterHunterResolved(nextAfter);
          }
        );
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

    // Phe Thứ 3 (Thằng Ngố / Kẻ Chán Đời): bị treo cổ ban ngày -> thắng ngay lập tức!
    if (target.roleId === 'jester') {
      state.phase = 'GAME_OVER';
      state.winner = 'jester';
      window.AudioEngine.playVictory();
      const winMsg = `Trời ơi! ${target.name} chính là Thằng Ngố (Kẻ Chán Đời)! Cả làng đã bị lừa treo cổ và Phe Thứ 3 giành chiến thắng độc lập!`;
      addLog(`🃏 ${winMsg}`);
      syncStateToClients();
      renderHost();
      setBotSpeech(winMsg);
      return;
    }

    const chainList = [];
    const chained = applyLoversChainDeath(chainList);
    const chainMsg =
      chained.length > 0 ? ` 💔 ${chained.map((d) => `${d.partner.name} cũng chết theo vì tình!`).join(' ')}` : '';

    if (target.roleId === 'hunter') {
      state.phase = 'HUNTER_REVENGE';
      state.pendingHunterId = target.id;
      state.pendingHunterNext = 'NEXT_NIGHT';
      syncStateToClients();
      renderHost();
      setBotSpeech(`Cả làng đã biểu quyết treo cổ ${target.name}!${chainMsg}`, () => {
        triggerHunterPrompt(target);
      });
      return;
    }

    syncStateToClients();
    renderHost();
    setBotSpeech(`Cả làng đã biểu quyết treo cổ ${target.name}!${chainMsg}`, () => {
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
    const alive = state.players.filter((p) => p.alive);
    const aliveWolves = alive.filter((p) => isWolfRole(p.roleId)).length;
    const aliveSK = alive.filter((p) => p.roleId === 'serial_killer').length;
    const aliveNonWolves = alive.filter((p) => !isWolfRole(p.roleId)).length;

    let isCrossTeamLoversWin = false;
    if (Array.isArray(state.lovers) && state.lovers.length === 2 && alive.length === 2) {
      const [idA, idB] = state.lovers;
      const pA = alive.find((p) => p.id === idA);
      const pB = alive.find((p) => p.id === idB);
      if (pA && pB && getPlayerSide(pA.roleId) !== getPlayerSide(pB.roleId)) {
        isCrossTeamLoversWin = true;
      }
    }

    let winner = null;
    if (isCrossTeamLoversWin) {
      winner = 'lovers';
    } else if (aliveSK > 0 && (alive.length === 1 || (alive.length === 2 && aliveWolves === 0))) {
      winner = 'serial_killer';
    } else if (aliveWolves === 0 && aliveSK === 0) {
      winner = 'villager';
    } else if (aliveSK === 0 && aliveWolves >= aliveNonWolves) {
      winner = 'werewolf';
    }

    if (!winner) return false;

    clearHostTimers();
    state.phase = 'GAME_OVER';
    state.winner = winner;
    window.AudioEngine.playVictory();
    const winMessages = {
      villager: 'Chúc mừng Phe Dân Làng đã chiến thắng! Toàn bộ Ma Sói và Sát Nhân đã bị tiêu diệt!',
      werewolf: 'Ma Sói đã chiếm quyền kiểm soát ngôi làng! Phe Ma Sói chiến thắng!',
      serial_killer: 'Sát Nhân Độc Hành là kẻ sống sót cuối cùng! Phe Thứ 3 Sát Nhân chiến thắng độc lập!',
      lovers: 'Cặp Đôi Tình Nhân đã sống sót đến giây phút cuối cùng! Tình yêu bất diệt chiến thắng!'
    };
    const winMsg = winMessages[winner] || 'Trò chơi kết thúc!';
    addLog(`🏆 ${winMsg}`);
    syncStateToClients();
    renderHost();
    setBotSpeech(winMsg);
    return true;
  }

  function getDayVoteTally() {
    const groups = {}; // targetId -> [{ id, name, avatarId }]
    Object.entries(state.dayVotes || {}).forEach(([vId, tId]) => {
      const voter = state.players.find((p) => p.id === vId);
      if (!voter || !voter.alive) return;
      if (!groups[tId]) groups[tId] = [];
      groups[tId].push({ id: voter.id, name: voter.name, avatarId: voter.avatarId });
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

      const meSynced = (state.players || []).find((p) => p.id === session.clientId);
      if (meSynced && meSynced.avatarId) {
        myAvatarId = meSynced.avatarId;
      }

      if (state.phase === 'LOBBY') {
        clientSecret = null;
        witchInfo = null;
        alphaInfo = null;
        seerResult = null;
        wolfPeersChoices = {};
        wolfConfirmedMap = {};
        selectedCupidTargets = [];
        cardRevealed = false;
      }

      if (state.phase === 'NIGHT' && (prevPhase !== 'NIGHT' || prevStep !== state.nightStep)) {
        selectedNightTarget = null;
        selectedCupidTargets = [];
        witchSaveChoice = false;
        witchPoisonChoice = null;
        alphaInfo = null;
        seerResult = null;
        wolfPeersChoices = {};
        wolfConfirmedMap = {};

        const isMyTurn =
          clientSecret &&
          (state.nightStep === clientSecret.roleId ||
            (state.nightStep === 'werewolf' && isWolfRole(clientSecret.roleId)));
        if (isMyTurn && isMeAlive() && 'vibrate' in navigator) {
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

    if (type === 'WW_ALPHA_INFO') {
      alphaInfo = payload;
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

    const openWwQrZoom = () => {
      if (!state) return;
      const url = window.RoomNetwork.buildShareUrl('werewolf', state.roomCode);
      window.AppUI.openQrZoomModal('🐺 Quét QR vào phòng Ma Sói', state.roomCode, url);
    };
    const wwQrEl = document.getElementById('ww-host-qr');
    const wwQrBtn = document.getElementById('ww-qr-zoom-btn');
    if (wwQrEl) wwQrEl.onclick = openWwQrZoom;
    if (wwQrBtn) wwQrBtn.onclick = openWwQrZoom;

    document.getElementById('ww-host-test-voice').onclick = () => {
      window.AudioEngine.unlock();
      window.AudioEngine.speak('Xin chào cả hội! Bot Quản Trò đã sẵn sàng dẫn dắt ván Ma Sói hôm nay.');
    };

    const leaveHost = async () => {
      if (state && state.phase !== 'LOBBY') {
        const ok = await window.AppUI.confirmDialog(
          'Thoát phòng Ma Sói?',
          'Ván đấu đang diễn ra sẽ kết thúc nếu Host thoát.'
        );
        if (!ok) return;
      }
      cleanup();
      window.AppUI.goHome();
    };

    document.getElementById('ww-host-leave').onclick = leaveHost;
    document.getElementById('ww-ingame-leave').onclick = leaveHost;
    document.getElementById('ww-ingame-sound').onclick = () => {
      window.AppUI.openSoundSettings();
    };

    document.getElementById('ww-host-add-demo').onclick = () => {
      if (!state || state.phase !== 'LOBBY') return;
      const demoNames = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc'];
      const name = `${demoNames[(demoCounter - 1) % demoNames.length]} (Test ${demoCounter})`;
      const avatarId = getRandomAvatarId(state.players.length);
      demoCounter += 1;
      state.players.push({
        id: `demo_${Date.now()}_${demoCounter}`,
        name,
        avatarId,
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
      if (state.nightStep === 'cupid') finishCupidStep([]);
      else if (state.nightStep === 'guard') finishGuardStep(null);
      else if (state.nightStep === 'werewolf') {
        const prey = state.players.find((p) => p.alive && !isWolfRole(p.roleId));
        finishWerewolfStep(pickMajorityWolfTarget(prey ? prey.id : null));
      } else if (state.nightStep === 'alpha_wolf') finishAlphaWolfStep(false);
      else if (state.nightStep === 'seer') finishSeerStep();
      else if (state.nightStep === 'witch') finishWitchStep(false, null);
      else if (state.nightStep === 'serial_killer') finishSerialKillerStep(null);
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

  function buildPlayerLabelEl(player, sizeClass = 'avatar-md', suffix = '') {
    const wrap = document.createElement('span');
    wrap.className = 'player-name-with-avatar';
    wrap.appendChild(window.AppUI.createAvatarEl(player?.avatarId, sizeClass));
    const txt = document.createElement('strong');
    txt.textContent = `${player?.name || '?'}${suffix}`;
    wrap.appendChild(txt);
    return wrap;
  }

  function renderHost() {
    if (!state) return;
    const isActive = state.phase !== 'LOBBY';
    const phaseMode = state.phase === 'NIGHT' || state.phase === 'ROLE_REVEAL' ? 'NIGHT' : 'DAY';
    window.AppUI.setActiveGameMode(isActive, phaseMode);

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
        li.className = 'player-item pop-in';
        const left = buildPlayerLabelEl(p, 'avatar-md');

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
    const order = [
      'werewolf',
      'alpha_wolf',
      'seer',
      'guard',
      'witch',
      'hunter',
      'cupid',
      'elder',
      'jester',
      'serial_killer',
      'villager'
    ];
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
        const max = roleId === 'werewolf' || roleId === 'villager' ? 10 : 1;
        state.rolesConfig[roleId] = Math.min(max, (state.rolesConfig[roleId] || 0) + 1);
        syncStateToClients();
        renderHost();
      });

      stepper.append(minus, num, plus);
      row.append(info, stepper);
      configEl.appendChild(row);
    });

    const totalNote = document.getElementById('ww-host-role-total');
    const wolves = (state.rolesConfig.werewolf || 0) + (state.rolesConfig.alpha_wolf || 0);
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
        cupid: '💘 Thần Tình Yêu ghép đôi 2 người (Đêm 1)',
        guard: '🛡️ Bảo Vệ thức dậy bảo vệ 1 người',
        werewolf: '🐺 Ma Sói thức dậy chọn con mồi',
        alpha_wolf: '🩸 Sói Đầu Đàn quyết định Nguyền hóa nạn nhân',
        seer: '🔮 Tiên Tri thức dậy soi thân phận',
        witch: '🧪 Phù Thủy thức dậy dùng bình thuốc',
        serial_killer: '🗡️ Sát Nhân thức dậy chọn mục tiêu ám sát'
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
          li.className = 'vote-tally-item pop-in';

          const leftCol = document.createElement('div');
          if (tId === '__skip__') {
            const skipLabel = document.createElement('strong');
            skipLabel.textContent = '🏳️ Bỏ phiếu trắng';
            leftCol.appendChild(skipLabel);
          } else {
            const targetPlayer = state.players.find((p) => p.id === tId);
            leftCol.appendChild(buildPlayerLabelEl(targetPlayer, 'avatar-md'));
          }

          const voterWrap = document.createElement('div');
          voterWrap.className = 'voter-avatars-mini';
          voters.forEach((v) => {
            const pill = document.createElement('span');
            pill.className = 'voter-pill-mini';
            pill.appendChild(window.AppUI.createAvatarEl(v.avatarId, 'avatar-sm'));
            const vName = document.createElement('span');
            vName.textContent = v.name;
            pill.appendChild(vName);
            voterWrap.appendChild(pill);
          });
          leftCol.appendChild(voterWrap);

          const countPill = document.createElement('span');
          countPill.className = 'pill pill-ready';
          countPill.textContent = `${voters.length} phiếu`;

          li.append(leftCol, countPill);
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
          btn.className = 'lynch-btn target-btn-avatar';
          btn.disabled = !canLynch;
          btn.appendChild(window.AppUI.createAvatarEl(p.avatarId, 'avatar-md'));
          const span = document.createElement('span');
          span.textContent = `Treo cổ ${p.name}`;
          btn.appendChild(span);
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
      const winMap = {
        villager: '🏆 PHE DÂN LÀNG CHIẾN THẮNG!',
        werewolf: '🐺 PHE MA SÓI CHIẾN THẮNG!',
        jester: '🃏 PHE THỨ 3 — THẰNG NGỐ (KẺ CHÁN ĐỜI) CHIẾN THẮNG!',
        serial_killer: '🗡️ PHE THỨ 3 — SÁT NHÂN ĐỘC HÀNH CHIẾN THẮNG!',
        lovers: '💘 PHE THỨ 3 — CẶP ĐÔI TÌNH NHÂN CHIẾN THẮNG!'
      };
      banner.textContent = winMap[state.winner] || '🏆 KẾT THÚC!';

      const revealEl = document.getElementById('ww-host-reveal-list');
      revealEl.innerHTML = '';
      const loverSet = new Set(state.lovers || []);
      state.players.forEach((p) => {
        const r = WEREWOLF_ROLES[p.roleId] || WEREWOLF_ROLES.villager;
        const li = document.createElement('li');
        li.className = 'reveal-item pop-in';
        const left = buildPlayerLabelEl(p, 'avatar-md', ` (${p.alive ? 'Sống' : 'Đã chết'})`);
        const right = document.createElement('span');
        const loverMark = loverSet.has(p.id) ? ' 💘' : '';
        right.textContent = `${r.icon} ${r.name}${loverMark}`;
        li.append(left, right);
        revealEl.appendChild(li);
      });
    }
  }

  // ==================== PLAYER UI & EVENTS ====================
  function bindPlayerEvents() {
    const leavePlayer = () => {
      if (session) session.send('WW_LEAVE', {});
      cleanup();
      window.AppUI.goHome();
    };

    document.getElementById('ww-pl-leave').onclick = leavePlayer;
    document.getElementById('ww-pl-ingame-leave').onclick = leavePlayer;

    document.getElementById('ww-pl-edit-name').onclick = async () => {
      const profile = await window.AppUI.promptProfileDialog(myName, myAvatarId);
      if (profile && (profile.name !== myName || profile.avatarId !== myAvatarId)) {
        myName = profile.name;
        myAvatarId = profile.avatarId;
        localStorage.setItem('hq_player_name', myName);
        window.AppUI.saveAvatarId(myAvatarId);
        if (session) session.send('WW_RENAME', { name: myName, avatarId: myAvatarId });
        renderPlayer();
      }
    };

    document.getElementById('ww-pl-ready-btn').onclick = () => {
      window.AudioEngine.unlock();
      const me = state.players.find((p) => p.id === session.clientId);
      const nextReady = me ? !me.ready : true;
      session.send('WW_READY', { ready: nextReady });
    };

    window.AppUI.bindHoldToPeekCard(document.getElementById('ww-pl-toggle-card'), (show) => {
      if (cardRevealed === show) return;
      cardRevealed = show;
      renderSecretCard();
    });
  }

  function renderSecretCard() {
    const btn = document.getElementById('ww-pl-toggle-card');
    const bgLayer = document.getElementById('ww-pl-card-bg');
    btn.setAttribute('aria-expanded', String(cardRevealed));
    btn.classList.toggle('is-flipped', cardRevealed);

    const cardAv = document.getElementById('ww-pl-card-avatar');
    if (cardAv) {
      cardAv.innerHTML = '';
      cardAv.appendChild(window.AppUI.createAvatarEl(myAvatarId, 'avatar-xl'));
    }
    const cardOwner = document.getElementById('ww-pl-card-owner');
    if (cardOwner) {
      cardOwner.textContent = `${myName || 'Bạn'} — 👆 Nhấn & GIỮ để xem Vai Trò`;
    }

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
      const extraLines = [];
      if (clientSecret.teammates && clientSecret.teammates.length > 0) {
        extraLines.push(`Đồng bọn Ma Sói: ${clientSecret.teammates.map((m) => m.name).join(', ')}`);
      }
      if (clientSecret.loverInfo) {
        extraLines.push(
          `💑 Người yêu định mệnh: ${clientSecret.loverInfo.name} (${clientSecret.loverInfo.roleName})`
        );
      }
      if (extraLines.length > 0) {
        matesEl.hidden = false;
        matesEl.textContent = extraLines.join(' • ');
      } else {
        matesEl.hidden = true;
      }
    }
  }

  function renderPlayer() {
    if (!state || !session) return;
    const isActive = state.phase !== 'LOBBY';
    const phaseMode = state.phase === 'NIGHT' || state.phase === 'ROLE_REVEAL' ? 'NIGHT' : 'DAY';
    window.AppUI.setActiveGameMode(isActive, phaseMode);

    document.getElementById('ww-pl-room-code').textContent = state.roomCode;
    document.getElementById('ww-pl-my-name').textContent = myName;
    const myAvSlot = document.getElementById('ww-pl-my-avatar');
    if (myAvSlot) {
      myAvSlot.innerHTML = '';
      myAvSlot.appendChild(window.AppUI.createAvatarEl(myAvatarId, 'avatar-md'));
    }

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
        li.className = 'player-item pop-in';
        const left = buildPlayerLabelEl(p, 'avatar-sm', p.id === session.clientId ? ' (Bạn)' : '');
        const pill = document.createElement('span');
        pill.className = `pill ${p.ready ? 'pill-ready' : 'pill-wait'}`;
        pill.textContent = p.ready ? 'Sẵn sàng' : 'Đang chờ';
        li.append(left, pill);
        list.appendChild(li);
      });
      return;
    }

    lobbyEl.hidden = true;
    gameEl.hidden = false;
    const activeChip = document.getElementById('ww-pl-active-player');
    if (activeChip) {
      activeChip.innerHTML = '';
      activeChip.appendChild(window.AppUI.createAvatarEl(myAvatarId, 'avatar-sm'));
      const chipName = document.createElement('span');
      chipName.textContent = myName;
      activeChip.appendChild(chipName);
    }
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
  }

  function makeTargetBtn(player, labelText, isSelected, isDisabled, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `target-btn target-btn-avatar ${isSelected ? 'selected' : ''}`;
    btn.disabled = Boolean(isDisabled);
    btn.appendChild(window.AppUI.createAvatarEl(player.avatarId, 'avatar-md'));
    const span = document.createElement('span');
    span.textContent = labelText;
    btn.appendChild(span);
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderPlayerActionArea(alive) {
    const area = document.getElementById('ww-pl-action-area');
    area.innerHTML = '';

    if (state.phase === 'GAME_OVER') {
      const box = document.createElement('div');
      box.className = 'winner-banner';
      const winMap = {
        villager: '🏆 PHE DÂN LÀNG CHIẾN THẮNG!',
        werewolf: '🐺 PHE MA SÓI CHIẾN THẮNG!',
        jester: '🃏 PHE THỨ 3 — THẰNG NGỐ (KẺ CHÁN ĐỜI) CHIẾN THẮNG!',
        serial_killer: '🗡️ PHE THỨ 3 — SÁT NHÂN ĐỘC HÀNH CHIẾN THẮNG!',
        lovers: '💘 PHE THỨ 3 — CẶP ĐÔI TÌNH NHÂN CHIẾN THẮNG!'
      };
      box.textContent = winMap[state.winner] || '🏆 KẾT THÚC!';
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
            grid.appendChild(
              makeTargetBtn(p, `🎯 Bắn ${p.name}`, false, false, () => {
                session.send('WW_ACTION', { step: 'hunter', targetId: p.id });
              })
            );
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
          grid.appendChild(
            makeTargetBtn(
              p,
              myVote === p.id ? `✓ Vote ${p.name}` : p.name,
              myVote === p.id,
              false,
              () => {
                session.send('WW_DAY_VOTE', { targetId: p.id });
              }
            )
          );
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
    const activeTurn =
      myRole &&
      (state.nightStep === myRole || (state.nightStep === 'werewolf' && isWolfRole(myRole)));
    if (!activeTurn) {
      area.innerHTML = `<div class="sleep-box"><span class="sleep-icon" aria-hidden="true">🌙</span><p>Đang trong đêm... Hãy nhắm mắt lại và lắng nghe Bot Quản Trò.</p></div>`;
      return;
    }

    if (state.nightStep === 'cupid') renderCupidActionUI(area);
    else if (state.nightStep === 'guard') renderGuardActionUI(area);
    else if (state.nightStep === 'werewolf') renderWerewolfActionUI(area);
    else if (state.nightStep === 'alpha_wolf') renderAlphaWolfActionUI(area);
    else if (state.nightStep === 'seer') renderSeerActionUI(area);
    else if (state.nightStep === 'witch') renderWitchActionUI(area);
    else if (state.nightStep === 'serial_killer') renderSerialKillerActionUI(area);
  }

  function renderCupidActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '💘 Lượt Thần Tình Yêu: Chọn 2 người để ghép đôi';
    area.appendChild(h);

    const hint = document.createElement('p');
    hint.className = 'panel-desc';
    hint.textContent = `Đã chọn ${selectedCupidTargets.length}/2 người (có thể chọn cả chính mình):`;
    area.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    state.players
      .filter((p) => p.alive)
      .forEach((p) => {
        const isSel = selectedCupidTargets.includes(p.id);
        grid.appendChild(
          makeTargetBtn(p, isSel ? `💘 ${p.name}` : p.name, isSel, false, () => {
            if (selectedCupidTargets.includes(p.id)) {
              selectedCupidTargets = selectedCupidTargets.filter((id) => id !== p.id);
            } else if (selectedCupidTargets.length < 2) {
              selectedCupidTargets = [...selectedCupidTargets, p.id];
            } else {
              selectedCupidTargets = [selectedCupidTargets[1], p.id];
            }
            renderPlayer();
          })
        );
      });
    area.appendChild(grid);

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-primary btn-block';
    confirm.disabled = selectedCupidTargets.length !== 2;
    confirm.textContent = '💘 Xác nhận ghép đôi Tình Nhân';
    confirm.addEventListener('click', () => {
      session.send('WW_ACTION', { step: 'cupid', targetIds: selectedCupidTargets });
    });
    area.appendChild(confirm);
  }

  function renderAlphaWolfActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🩸 Lượt Sói Đầu Đàn (Kỹ năng Nguyền Hóa)';
    area.appendChild(h);

    const victimName = alphaInfo?.victimName;
    const canConvert = Boolean(alphaInfo?.canConvert && victimName);

    const infoBox = document.createElement('div');
    infoBox.className = 'result-banner';
    infoBox.innerHTML = victimName
      ? `Đêm nay bầy Sói đã chọn cắn <strong>${escapeHtml(victimName)}</strong>. Bạn có muốn dùng quyền Nguyền <strong>1 lần duy nhất</strong> biến người này thành Ma Sói thay vì giết họ không?`
      : 'Đêm nay chưa có mục tiêu để nguyền hóa.';
    area.appendChild(infoBox);

    if (canConvert) {
      const convertBtn = document.createElement('button');
      convertBtn.type = 'button';
      convertBtn.className = 'btn btn-danger btn-block';
      convertBtn.textContent = `🩸 Nguyền hóa ${victimName} thành Ma Sói`;
      convertBtn.addEventListener('click', () => {
        session.send('WW_ACTION', { step: 'alpha_wolf', convert: true });
      });
      area.appendChild(convertBtn);
    }

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'btn btn-secondary btn-block';
    skipBtn.style.marginTop = '0.55rem';
    skipBtn.textContent = '⏭️ Không nguyền (Để Sói cắn như bình thường)';
    skipBtn.addEventListener('click', () => {
      session.send('WW_ACTION', { step: 'alpha_wolf', convert: false });
    });
    area.appendChild(skipBtn);
  }

  function renderSerialKillerActionUI(area) {
    const h = document.createElement('h3');
    h.textContent = '🗡️ Lượt Sát Nhân Độc Hành: Chọn mục tiêu đêm nay';
    area.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    state.players
      .filter((p) => p.alive && p.id !== session.clientId)
      .forEach((p) => {
        grid.appendChild(
          makeTargetBtn(p, `🗡️ ${p.name}`, selectedNightTarget === p.id, false, () => {
            selectedNightTarget = p.id;
            renderPlayer();
          })
        );
      });
    area.appendChild(grid);

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'btn btn-danger btn-block';
    confirm.disabled = !selectedNightTarget;
    confirm.textContent = '🗡️ Ám sát người này';
    confirm.addEventListener('click', () => {
      session.send('WW_ACTION', { step: 'serial_killer', targetId: selectedNightTarget });
    });
    area.appendChild(confirm);
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
        const blocked = state.lastGuardedId === p.id;
        grid.appendChild(
          makeTargetBtn(
            p,
            blocked ? `${p.name} (Đêm trước)` : p.name,
            selectedNightTarget === p.id,
            blocked,
            () => {
              selectedNightTarget = p.id;
              renderPlayer();
            }
          )
        );
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
    const mateIds = new Set((clientSecret?.teammates || []).map((m) => m.id));
    const candidates = state.players.filter(
      (p) => p.alive && p.id !== session.clientId && !mateIds.has(p.id)
    );

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    candidates.forEach((p) => {
      grid.appendChild(
        makeTargetBtn(p, p.name, selectedNightTarget === p.id, iConfirmed, () => {
          selectedNightTarget = p.id;
          session.send('WW_ACTION', { step: 'werewolf', targetId: p.id, confirm: false });
          renderPlayer();
        })
      );
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

    const inspectedSet = new Set(state.seerHistory || []);
    const candidates = state.players.filter((p) => p.alive && p.id !== session.clientId);
    const hasUninspected = candidates.some((p) => !inspectedSet.has(p.id));

    const pNote = document.createElement('p');
    pNote.className = 'panel-desc';
    pNote.textContent = hasUninspected
      ? 'Chọn 1 người chưa soi để biết họ có phải Ma Sói hay không:'
      : 'Bạn đã soi hết tất cả người chơi còn sống! Hãy ấn xong để tiếp tục.';
    area.appendChild(pNote);

    const grid = document.createElement('div');
    grid.className = 'target-grid';
    candidates.forEach((p) => {
      const alreadyDone = inspectedSet.has(p.id);
      grid.appendChild(
        makeTargetBtn(
          p,
          alreadyDone ? `${p.name} (Đã soi đêm trước)` : `🔮 ${p.name}`,
          false,
          alreadyDone,
          () => {
            session.send('WW_ACTION', { step: 'seer', action: 'inspect', targetId: p.id });
          }
        )
      );
    });
    area.appendChild(grid);

    if (!hasUninspected) {
      const skipBtn = document.createElement('button');
      skipBtn.type = 'button';
      skipBtn.className = 'btn btn-primary btn-block';
      skipBtn.textContent = 'Nhắm mắt lại';
      skipBtn.addEventListener('click', () => {
        session.send('WW_ACTION', { step: 'seer', action: 'done' });
      });
      area.appendChild(skipBtn);
    }
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
        if (witchSaveChoice && info.victimId && witchPoisonChoice === info.victimId) {
          witchPoisonChoice = null;
        }
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
        .filter((p) => p.alive && p.id !== session.clientId && !(witchSaveChoice && info.victimId === p.id))
        .forEach((p) => {
          grid.appendChild(
            makeTargetBtn(
              p,
              `☠️ ${p.name}`,
              witchPoisonChoice === p.id,
              false,
              () => {
                witchPoisonChoice = witchPoisonChoice === p.id ? null : p.id;
                renderPlayer();
              }
            )
          );
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
