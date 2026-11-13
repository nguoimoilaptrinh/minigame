// Bộ kết nối phòng thời gian thực đa kênh v2.1 (BroadcastChannel + MQTT over WSS + PeerJS)
// Chống mất gói, tự đồng bộ lại khi kết nối xong, hoạt động 100% trên GitHub Pages
window.RoomNetwork = (() => {
  const MQTT_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
  const TOPIC_PREFIX = 'hoiquan-party-v2';

  function getOrCreateClientId() {
    let id = sessionStorage.getItem('hq_client_id');
    if (!id) {
      id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      sessionStorage.setItem('hq_client_id', id);
    }
    return id;
  }

  function generateRoomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function buildShareUrl(gameType, roomCode) {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('game', gameType);
    url.searchParams.set('room', roomCode);
    return url.toString();
  }

  function createSession({ gameType, roomCode, isHost, onMessage, onStatus, onConnected }) {
    const clientId = getOrCreateClientId();
    const seenMsgIds = new Set();
    let bc = null;
    let mqttClient = null;
    let peer = null;
    const peerConns = new Map();
    let closed = false;
    let mqttReady = false;
    let peerReady = false;

    const topicToHost = `${TOPIC_PREFIX}/${gameType}/${roomCode}/to-host`;
    const topicToClients = `${TOPIC_PREFIX}/${gameType}/${roomCode}/to-clients`;

    function reportStatus() {
      if (closed || typeof onStatus !== 'function') return;
      if (mqttReady || peerReady) {
        const channels = [];
        if (mqttReady) channels.push('Cloud');
        if (peerReady) channels.push('P2P');
        onStatus(`Đã kết nối (${channels.join(' + ')})`, true);
      } else {
        onStatus('Nội bộ / Đang nối mạng...', false);
      }
    }

    function rememberMsg(id) {
      if (seenMsgIds.has(id)) return false;
      seenMsgIds.add(id);
      if (seenMsgIds.size > 800) {
        const first = seenMsgIds.values().next().value;
        seenMsgIds.delete(first);
      }
      return true;
    }

    function handleIncoming(raw) {
      if (closed || !raw || !raw.msgId) return;
      if (raw.roomCode && raw.roomCode !== roomCode) return;
      if (raw.senderId === clientId) return;
      if (!rememberMsg(raw.msgId)) return;
      if (!isHost && raw.targetId && raw.targetId !== clientId) return;
      if (typeof onMessage === 'function') {
        onMessage(raw);
      }
    }

    // 1. BroadcastChannel (tức thì giữa các tab cùng máy)
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel(`${TOPIC_PREFIX}_${gameType}_${roomCode}`);
        bc.onmessage = (ev) => handleIncoming(ev.data);
      } catch (_) {}
    }

    // 2. MQTT over WSS (xuyên tường lửa, 4G, Wi-Fi nhà, hoạt động chuẩn trên GitHub Pages)
    if (window.mqtt && typeof window.mqtt.connect === 'function') {
      try {
        mqttClient = window.mqtt.connect(MQTT_BROKER_URL, {
          clientId: `hq_${clientId}_${Math.random().toString(16).slice(2, 6)}`,
          clean: true,
          connectTimeout: 8000,
          reconnectPeriod: 2500
        });

        mqttClient.on('connect', () => {
          if (closed) return;
          mqttReady = true;
          const subTopic = isHost ? topicToHost : topicToClients;
          mqttClient.subscribe(subTopic, { qos: 0 }, () => {
            if (!closed && typeof onConnected === 'function') {
              onConnected();
            }
          });
          reportStatus();
        });

        mqttClient.on('message', (_topic, payloadBytes) => {
          try {
            const parsed = JSON.parse(payloadBytes.toString());
            handleIncoming(parsed);
          } catch (_) {}
        });

        mqttClient.on('offline', () => {
          mqttReady = false;
          reportStatus();
        });

        mqttClient.on('error', () => {
          mqttReady = false;
          reportStatus();
        });
      } catch (_) {}
    }

    // 3. PeerJS WebRTC P2P song song
    if (typeof window.Peer === 'function') {
      try {
        const hostPeerId = `hq2-${gameType}-${roomCode}-host`;
        peer = isHost ? new window.Peer(hostPeerId) : new window.Peer();

        peer.on('open', () => {
          if (closed) return;
          if (isHost) {
            peerReady = true;
            reportStatus();
          } else {
            const conn = peer.connect(hostPeerId, { reliable: true });
            conn.on('open', () => {
              peerReady = true;
              peerConns.set('host', conn);
              reportStatus();
              if (!closed && typeof onConnected === 'function') {
                onConnected();
              }
            });
            conn.on('data', (data) => handleIncoming(data));
            conn.on('close', () => {
              peerConns.delete('host');
            });
          }
        });

        if (isHost) {
          peer.on('connection', (conn) => {
            conn.on('open', () => {
              peerConns.set(conn.peer, conn);
            });
            conn.on('data', (data) => handleIncoming(data));
            conn.on('close', () => peerConns.delete(conn.peer));
          });
        }

        peer.on('error', () => {
          reportStatus();
        });
      } catch (_) {}
    }

    reportStatus();

    function send(type, payload = {}, targetId = null) {
      if (closed) return;
      const packet = {
        msgId: `${clientId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        roomCode,
        senderId: clientId,
        targetId,
        type,
        payload,
        ts: Date.now()
      };
      rememberMsg(packet.msgId);

      if (bc) {
        try {
          bc.postMessage(packet);
        } catch (_) {}
      }

      if (mqttClient && mqttClient.connected) {
        try {
          const destTopic = isHost ? topicToClients : topicToHost;
          mqttClient.publish(destTopic, JSON.stringify(packet), { qos: 0 });
        } catch (_) {}
      }

      for (const conn of peerConns.values()) {
        if (conn && conn.open) {
          try {
            conn.send(packet);
          } catch (_) {}
        }
      }
    }

    function destroy() {
      if (closed) return;
      closed = true;
      window.removeEventListener('pagehide', destroy);
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
        bc = null;
      }
      if (mqttClient) {
        try {
          mqttClient.end(true);
        } catch (_) {}
        mqttClient = null;
      }
      if (peer) {
        try {
          peer.destroy();
        } catch (_) {}
        peer = null;
      }
      peerConns.clear();
    }

    window.addEventListener('pagehide', destroy);

    return {
      clientId,
      roomCode,
      gameType,
      isHost,
      send,
      destroy
    };
  }

  return {
    getOrCreateClientId,
    generateRoomCode,
    buildShareUrl,
    createSession
  };
})();
