import { create } from "zustand";
import api from "./axios";
import { useSocketStore } from "./socket";

// ─────────────────────────────────────────────────────────────────────────────
// TURN / STUN server config
// ─────────────────────────────────────────────────────────────────────────────
const fetchIceServers = async () => {
  try {
    const response = await api.get("/turn/credentials");
    console.log("[WebRTC] TURN credentials from backend:", JSON.stringify(response.data, null, 2));
    return { iceServers: response.data };
  } catch (error) {
    console.error("[WebRTC] Failed to fetch ICE servers:", error);
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create RTCPeerConnection with state logging
// ─────────────────────────────────────────────────────────────────────────────
function createPC(iceServers) {
  const pc = new RTCPeerConnection({
    iceServers,
  });
  pc.onconnectionstatechange = () => console.log("[WebRTC] connectionState:", pc.connectionState);
  pc.oniceconnectionstatechange = () => console.log("[WebRTC] iceConnectionState:", pc.iceConnectionState);
  pc.onsignalingstatechange = () => console.log("[WebRTC] signalingState:", pc.signalingState);
  return pc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: getUserMedia with constraint logging
// ─────────────────────────────────────────────────────────────────────────────
async function getLocalAudioStream() {
  console.log("[WebRTC] Requesting getUserMedia audio...");
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  const tracks = stream.getAudioTracks();
  console.log("[WebRTC] Local audio tracks:", tracks.length);
  tracks.forEach((t) =>
    console.log(`  id=${t.id} label="${t.label}" enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
  );
  return stream;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wirePC - EXACTLY AS REQUESTED
// ONLY uses addTrack() to avoid duplicate senders / broken SDP negotiation.
// ─────────────────────────────────────────────────────────────────────────────
function wirePC(pc, localStream, onRemoteStream, targetUserId, socket, label) {
  // ONLY addTrack
  localStream.getAudioTracks().forEach(track => {
    pc.addTrack(track, localStream);

    console.log(
      `[WebRTC][${label}] addTrack id=${track.id} kind=${track.kind}`
    );
  });

  // ICE
  pc.onicecandidate = event => {
    if (event.candidate) {
      console.log(`[WebRTC][${label}] [ICE Candidate]`, event.candidate.candidate);
      socket.emit("ice-candidate", {
        targetUserId,
        candidate: event.candidate,
      });
    } else {
      console.log(`[WebRTC][${label}] ICE gathering complete`);
    }
  };

  // Remote stream
  pc.ontrack = event => {
    console.log(`[WebRTC][${label}] ontrack fired`);

    const remoteStream = event.streams[0];

    if (remoteStream) {
      console.log(
        `[WebRTC][${label}] remote audio tracks =`,
        remoteStream.getAudioTracks().length
      );

      onRemoteStream(remoteStream);
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────
export const useCallStore = create((set, get) => ({
  callStatus: "idle",
  callType: null,
  remoteUserId: null,
  remoteUserName: null,
  remoteUserAvatar: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  callDurationSeconds: 0,
  callId: null,
  incomingOffer: null,
  pendingCandidates: [],
  _listenersInitialized: false,
  _callTimeoutId: null,
  _durationTimerId: null,

  // ─────────────────────────────────────────────────────────────────────────
  // initCallListeners
  // ─────────────────────────────────────────────────────────────────────────
  initCallListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    socket.off("incoming-call");
    socket.off("call-answer-forwarded");
    socket.off("call-connected");
    socket.off("ice-candidate-forwarded");
    socket.off("call-ended");
    socket.off("call-rejected");

    socket.on("incoming-call", (data) => get()._handleIncomingCall(data));
    socket.on("call-answer-forwarded", ({ answer }) => get()._handleCallAnswer(answer));
    socket.on("call-connected", () => {
      console.log("[WebCall] call-connected");
      if (get().callStatus === "outgoing") get()._transitionToActive();
    });
    socket.on("ice-candidate-forwarded", ({ candidate }) => get()._handleRemoteIceCandidate(candidate));
    socket.on("call-ended", () => { console.log("[WebCall] call-ended"); get()._cleanup(); });
    socket.on("call-rejected", () => { console.log("[WebCall] call-rejected"); get()._cleanup(); });

    set({ _listenersInitialized: true });
    console.log("[WebCall] Call listeners initialized");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // startCall — CALLER
  // ─────────────────────────────────────────────────────────────────────────
  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    if (get().callStatus !== "idle") {
      console.warn("[WebCall] startCall ignored — status:", get().callStatus);
      return;
    }

    console.log("[WebCall] === startCall → CALLER ===");

    try {
      const stream = await getLocalAudioStream();
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      // ONLY use addTrack
      wirePC(pc, stream, (rs) => set({ remoteStream: rs }), targetUserId, socket, "CALLER");

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("[WebCall] CALLER ICE:", s);
        if ((s === "connected" || s === "completed") && get().callStatus === "outgoing") {
          get()._transitionToActive();
        } else if (s === "failed" || s === "disconnected") {
          get()._cleanup();
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        console.log("[WebCall] CALLER conn:", s);
        if (s === "connected" && get().callStatus === "outgoing") get()._transitionToActive();
        else if (s === "failed" || s === "closed") get()._cleanup();
      };

      set({ localStream: stream, peerConnection: pc, remoteUserId: targetUserId, remoteUserName: name, remoteUserAvatar: avatar, callType: "audio", callStatus: "outgoing" });

      const offer = await pc.createOffer();
      // Use modern syntax directly
      await pc.setLocalDescription(offer);
      console.log("[WebCall] CALLER offer SDP:\n", offer.sdp);

      socket.emit("call-offer", { targetUserId, offer, callType: "audio" });

      const timeoutId = setTimeout(() => {
        if (get().callStatus === "outgoing") {
          socket.emit("call-end", { targetUserId });
          get()._cleanup();
        }
      }, 60_000);
      set({ _callTimeoutId: timeoutId });

    } catch (e) {
      console.error("[WebCall] startCall failed:", e);
      get()._cleanup();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // acceptCall — RECEIVER
  // ─────────────────────────────────────────────────────────────────────────
  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, incomingOffer, pendingCandidates, callId } = get();
    if (!socket || !remoteUserId) return;

    console.log("[WebCall] === acceptCall → RECEIVER ===");
    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    try {
      const stream = await getLocalAudioStream();
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      wirePC(pc, stream, (rs) => set({ remoteStream: rs }), remoteUserId, socket, "RECEIVER");

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("[WebCall] RECEIVER ICE:", s);
        if (s === "failed" || s === "disconnected") get()._cleanup();
      };

      set({ localStream: stream, peerConnection: pc });

      if (incomingOffer) {
        // MODERN SYNTAX: use offer directly
        await pc.setRemoteDescription(incomingOffer);
        console.log("[WebCall] RECEIVER set remote description (offer)");
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[WebCall] RECEIVER answer SDP:\n", answer.sdp);

      socket.emit("call-answer", { targetUserId: remoteUserId, answer, callId });

      // MODERN SYNTAX: addIceCandidate handles raw object
      for (const candidate of pendingCandidates) {
        try { await pc.addIceCandidate(candidate); }
        catch (e) { console.error("[WebCall] addIceCandidate failed:", e); }
      }
      set({ pendingCandidates: [], _callTimeoutId: null });

      get()._transitionToActive();

    } catch (e) {
      console.error("[WebCall] acceptCall failed:", e);
      get()._cleanup();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _transitionToActive
  // ─────────────────────────────────────────────────────────────────────────
  _transitionToActive: () => {
    if (get().callStatus === "active") return;

    const { _durationTimerId, _callTimeoutId } = get();
    if (_durationTimerId) clearInterval(_durationTimerId);
    if (_callTimeoutId) clearTimeout(_callTimeoutId);

    const timerId = setInterval(() => set((s) => ({ callDurationSeconds: s.callDurationSeconds + 1 })), 1000);

    set({ callStatus: "active", _durationTimerId: timerId, _callTimeoutId: null, callDurationSeconds: 0 });
    console.log("[WebCall] ✅ ACTIVE");
  },

  // ─────────────────────────────────────────────────────────────────────────
  // rejectCall / endCall
  // ─────────────────────────────────────────────────────────────────────────
  rejectCall: () => {
    const { remoteUserId, callId } = get();
    useSocketStore.getState().socket?.emit("call-reject", { targetUserId: remoteUserId, callId });
    get()._cleanup();
  },

  endCall: () => {
    const { remoteUserId, callId } = get();
    useSocketStore.getState().socket?.emit("call-end", { targetUserId: remoteUserId, callId });
    get()._cleanup();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // toggleMute
  // ─────────────────────────────────────────────────────────────────────────
  toggleMute: () => {
    set((state) => {
      const isMuted = !state.isMuted;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
          console.log(`[WebCall] mic track enabled=${track.enabled}`);
        });
      }
      return { isMuted };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _handleIncomingCall
  // ─────────────────────────────────────────────────────────────────────────
  _handleIncomingCall: (data) => {
    if (get().callStatus !== "idle") {
      console.log("[WebCall] Ignoring incoming-call — not idle:", get().callStatus);
      return;
    }
    console.log("[WebCall] Incoming call from:", data.callerName);

    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeoutId = setTimeout(() => {
      if (get().callStatus === "incoming") get()._cleanup();
    }, 60_000);

    set({
      callStatus: "incoming",
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserAvatar: data.callerAvatar ?? null,
      callType: data.callType ?? "audio",
      incomingOffer: data.offer,
      callId: data.callId ?? null,
      pendingCandidates: [],
      _callTimeoutId: timeoutId,
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _handleCallAnswer — CALLER side receives answer
  // ─────────────────────────────────────────────────────────────────────────
  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates, callStatus } = get();
    if (!peerConnection || callStatus !== "outgoing") {
      console.warn("[WebCall] _handleCallAnswer skipped — pc:", !!peerConnection, "status:", callStatus);
      return;
    }

    console.log("[WebCall] Setting remote description (answer)");
    try {
      // MODERN SYNTAX: pass answer directly
      await peerConnection.setRemoteDescription(answer);
      console.log("[WebCall] Remote description set ✅");

      // MODERN SYNTAX
      for (const candidate of pendingCandidates) {
        try { await peerConnection.addIceCandidate(candidate); }
        catch (e) { console.error("[WebCall] ICE flush failed:", e); }
      }
      set({ pendingCandidates: [] });

      get()._transitionToActive();
    } catch (e) {
      console.error("[WebCall] _handleCallAnswer failed:", e);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _handleRemoteIceCandidate
  // ─────────────────────────────────────────────────────────────────────────
  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();
    if (peerConnection && peerConnection.remoteDescription) {
      try { await peerConnection.addIceCandidate(candidate); }
      catch (e) { console.error("[WebCall] addIceCandidate failed:", e); }
    } else {
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _cleanup
  // ─────────────────────────────────────────────────────────────────────────
  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } = get();
    console.log("[WebCall] Cleaning up...");

    if (localStream) localStream.getTracks().forEach((t) => { try { t.stop(); } catch {} });

    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.close();
      } catch {}
    }

    if (_callTimeoutId) clearTimeout(_callTimeoutId);
    if (_durationTimerId) clearInterval(_durationTimerId);

    set({
      callStatus: "idle", callType: null, remoteUserId: null, remoteUserName: null,
      remoteUserAvatar: null, localStream: null, remoteStream: null, peerConnection: null,
      isMuted: false, callDurationSeconds: 0, callId: null, incomingOffer: null,
      pendingCandidates: [], _callTimeoutId: null, _durationTimerId: null,
    });
    console.log("[WebCall] Cleanup done.");
  },
}));
