import { create } from "zustand";
import api from "./axios";
import { useSocketStore } from "./socket";

// ─────────────────────────────────────────────────────────────────────────────
// TURN / STUN server config
// ─────────────────────────────────────────────────────────────────────────────
const fetchIceServers = async () => {
  try {
    const response = await api.get("/turn/credentials");
    return { iceServers: response.data };
  } catch (error) {
    console.error("[WebRTC] Failed to fetch ICE servers:", error);
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create a RTCPeerConnection with full debug logging
// ─────────────────────────────────────────────────────────────────────────────
function createPC(iceServers) {
  const pc = new RTCPeerConnection({ iceServers });

  pc.onconnectionstatechange = () => console.log("[WebRTC] connectionState:", pc.connectionState);
  pc.oniceconnectionstatechange = () => console.log("[WebRTC] iceConnectionState:", pc.iceConnectionState);
  pc.onsignalingstatechange = () => console.log("[WebRTC] signalingState:", pc.signalingState);

  return pc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get local audio stream with permission check
// ─────────────────────────────────────────────────────────────────────────────
async function getLocalAudioStream() {
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
    console.log(`  track id=${t.id} label="${t.label}" enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
  );

  return stream;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: wire local tracks, ICE, and ontrack onto a PC
// ─────────────────────────────────────────────────────────────────────────────
function wirePC(pc, localStream, onRemoteStream, targetUserId, socket, label) {
  // Add local tracks BEFORE createOffer / createAnswer
  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream);
    console.log(`[WebRTC][${label}] addTrack id=${track.id} kind=${track.kind}`);
  });

  // ICE candidate forwarding
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log(`[WebRTC][${label}] Sending ICE candidate`);
      socket.emit("ice-candidate", { targetUserId, candidate: event.candidate });
    }
  };

  // ── ontrack: critical — this is how remote audio arrives ──────────────
  pc.ontrack = (event) => {
    console.log(`[WebRTC][${label}] ontrack fired`);
    console.log(`  track kind=${event.track?.kind} id=${event.track?.id} enabled=${event.track?.enabled} readyState=${event.track?.readyState}`);
    console.log(`  streams count=${event.streams?.length}`);

    if (event.streams && event.streams[0]) {
      const remoteStream = event.streams[0];
      console.log(`[WebRTC][${label}] Remote stream id=${remoteStream.id}`);
      console.log(`  audio tracks: ${remoteStream.getAudioTracks().length}`);
      remoteStream.getAudioTracks().forEach((t) =>
        console.log(`  audio track id=${t.id} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
      );
      onRemoteStream(remoteStream);
    } else if (event.track) {
      // Fallback: build stream from individual track
      console.warn(`[WebRTC][${label}] ontrack: no streams[], building manually from track`);
      const fallbackStream = new MediaStream([event.track]);
      onRemoteStream(fallbackStream);
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

  // ────────────────────────────────────────────────────────────────────────
  // initCallListeners — idempotent socket event setup
  // ────────────────────────────────────────────────────────────────────────
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
      console.log("[WebCall] call-connected received");
      if (get().callStatus === "outgoing") get()._transitionToActive();
    });

    socket.on("ice-candidate-forwarded", ({ candidate }) => get()._handleRemoteIceCandidate(candidate));
    socket.on("call-ended", () => { console.log("[WebCall] Remote ended the call"); get()._cleanup(); });
    socket.on("call-rejected", () => { console.log("[WebCall] Remote rejected the call"); get()._cleanup(); });

    set({ _listenersInitialized: true });
  },

  // ────────────────────────────────────────────────────────────────────────
  // startCall — web user initiates outgoing call (CALLER)
  // ────────────────────────────────────────────────────────────────────────
  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    if (get().callStatus !== "idle") {
      console.warn("[WebCall] startCall called while not idle — ignoring");
      return;
    }

    try {
      // 1. Get local audio
      const stream = await getLocalAudioStream();

      // 2. Create peer connection
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      // 3. Wire tracks + ontrack BEFORE createOffer
      wirePC(pc, stream, (remoteStream) => set({ remoteStream }), targetUserId, socket, "CALLER");

      // 4. ICE state → fallback transition (primary = _handleCallAnswer)
      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log("[WebCall] Caller ICE state:", iceState);
        if ((iceState === "connected" || iceState === "completed") && get().callStatus === "outgoing") {
          get()._transitionToActive();
        } else if (iceState === "failed" || iceState === "disconnected") {
          get()._cleanup();
        }
      };

      pc.onconnectionstatechange = () => {
        const connState = pc.connectionState;
        console.log("[WebCall] Caller connection state:", connState);
        if (connState === "connected" && get().callStatus === "outgoing") {
          get()._transitionToActive();
        } else if (connState === "failed" || connState === "closed") {
          get()._cleanup();
        }
      };

      set({
        localStream: stream,
        peerConnection: pc,
        remoteUserId: targetUserId,
        remoteUserName: name,
        remoteUserAvatar: avatar,
        callType: "audio",
        callStatus: "outgoing",
      });

      // 5. Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("[WebCall] Offer SDP:\n", offer.sdp);

      socket.emit("call-offer", { targetUserId, offer, callType: "audio" });

      // 60s no-answer timeout
      const timeoutId = setTimeout(() => {
        if (get().callStatus === "outgoing") {
          console.log("[WebCall] Outgoing call timed out");
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

  // ────────────────────────────────────────────────────────────────────────
  // acceptCall — web user accepts incoming call (RECEIVER)
  // ────────────────────────────────────────────────────────────────────────
  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, incomingOffer, pendingCandidates, callId } = get();
    if (!socket || !remoteUserId) return;

    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    try {
      // 1. Get local audio
      const stream = await getLocalAudioStream();

      // 2. Create peer connection
      const iceConfig = await fetchIceServers();
      const pc = createPC(iceConfig.iceServers);

      // 3. Wire tracks + ontrack BEFORE setRemoteDescription
      wirePC(pc, stream, (remoteStream) => set({ remoteStream }), remoteUserId, socket, "RECEIVER");

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log("[WebCall] Receiver ICE state:", iceState);
        if (iceState === "failed" || iceState === "disconnected") get()._cleanup();
      };

      set({ localStream: stream, peerConnection: pc });

      // 4. Set remote description (offer)
      if (incomingOffer) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
        console.log("[WebCall] Set remote description (offer)");
      }

      // 5. Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("[WebCall] Answer SDP:\n", answer.sdp);

      socket.emit("call-answer", { targetUserId: remoteUserId, answer, callId });

      // 6. Flush queued ICE candidates
      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[WebCall] Failed to add queued ICE candidate:", e);
        }
      }
      set({ pendingCandidates: [], _callTimeoutId: null });

      // 7. Transition to active
      get()._transitionToActive();

    } catch (e) {
      console.error("[WebCall] acceptCall failed:", e);
      get()._cleanup();
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _transitionToActive
  // ────────────────────────────────────────────────────────────────────────
  _transitionToActive: () => {
    const { callStatus, _durationTimerId, _callTimeoutId } = get();

    if (callStatus === "active") {
      console.log("[WebCall] Already active — skipping duplicate transition");
      return;
    }

    if (_durationTimerId) clearInterval(_durationTimerId);
    if (_callTimeoutId) clearTimeout(_callTimeoutId);

    const timerId = setInterval(() => {
      set((s) => ({ callDurationSeconds: s.callDurationSeconds + 1 }));
    }, 1000);

    set({
      callStatus: "active",
      _durationTimerId: timerId,
      _callTimeoutId: null,
      callDurationSeconds: 0,
    });

    console.log("[WebCall] ✅ Transitioned to ACTIVE");
  },

  // ────────────────────────────────────────────────────────────────────────
  // rejectCall
  // ────────────────────────────────────────────────────────────────────────
  rejectCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId) socket.emit("call-reject", { targetUserId: remoteUserId, callId });
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // endCall
  // ────────────────────────────────────────────────────────────────────────
  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId) socket.emit("call-end", { targetUserId: remoteUserId, callId });
    get()._cleanup();
  },

  // ────────────────────────────────────────────────────────────────────────
  // toggleMute
  // ────────────────────────────────────────────────────────────────────────
  toggleMute: () => {
    set((state) => {
      const isMuted = !state.isMuted;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
          console.log(`[WebCall] Audio track ${track.id} enabled=${track.enabled}`);
        });
      }
      return { isMuted };
    });
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleIncomingCall
  // ────────────────────────────────────────────────────────────────────────
  _handleIncomingCall: (data) => {
    if (get().callStatus !== "idle") {
      console.log("[WebCall] Ignored incoming call — already in a call:", get().callStatus);
      return;
    }

    console.log("[WebCall] Incoming call from:", data.callerName);

    const existingTimeout = get()._callTimeoutId;
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeoutId = setTimeout(() => {
      if (get().callStatus === "incoming") {
        console.log("[WebCall] Incoming call timed out (missed)");
        get()._cleanup();
      }
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

  // ────────────────────────────────────────────────────────────────────────
  // _handleCallAnswer — CALLER receives answer from receiver
  // ────────────────────────────────────────────────────────────────────────
  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates, callStatus } = get();
    if (!peerConnection) {
      console.warn("[WebCall] _handleCallAnswer: no peerConnection");
      return;
    }
    if (callStatus !== "outgoing") {
      console.warn("[WebCall] _handleCallAnswer: unexpected status:", callStatus);
      return;
    }

    console.log("[WebCall] Received call answer — setting remote description");

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("[WebCall] Remote description set (answer)");

      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[WebCall] Failed ICE candidate flush:", e);
        }
      }
      set({ pendingCandidates: [] });

      // Transition to active immediately after setting remote description
      get()._transitionToActive();
    } catch (e) {
      console.error("[WebCall] _handleCallAnswer failed:", e);
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _handleRemoteIceCandidate
  // ────────────────────────────────────────────────────────────────────────
  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();
    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("[WebCall] addIceCandidate failed:", e);
      }
    } else {
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  // ────────────────────────────────────────────────────────────────────────
  // _cleanup
  // ────────────────────────────────────────────────────────────────────────
  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } = get();

    console.log("[WebCall] Cleaning up call...");

    if (localStream) {
      localStream.getTracks().forEach((track) => { try { track.stop(); } catch { /* ignore */ } });
    }

    if (peerConnection) {
      try {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.onsignalingstatechange = null;
        peerConnection.close();
      } catch { /* ignore */ }
    }

    if (_callTimeoutId) clearTimeout(_callTimeoutId);
    if (_durationTimerId) clearInterval(_durationTimerId);

    set({
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
      _callTimeoutId: null,
      _durationTimerId: null,
    });

    console.log("[WebCall] Cleanup complete.");
  },
}));
