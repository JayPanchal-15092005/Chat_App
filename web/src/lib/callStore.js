import { create } from "zustand";
import api from "./axios";
import { useSocketStore } from "./socket";

const fetchIceServers = async () => {
  try {
    const response = await api.get("/turn/credentials");
    return {
      iceServers: response.data,
    };
  } catch (error) {
    console.error("Failed to fetch ICE servers:", error);
    return {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
  }
};

export const useCallStore = create((set, get) => ({
  callStatus: "idle", // 'idle' | 'outgoing' | 'incoming' | 'active'
  callType: null, // 'audio' | 'video'
  remoteUserId: null,
  remoteUserName: null,
  remoteUserAvatar: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  callDurationSeconds: 0,
  callId: null,
  _callTimeoutId: null,
  _durationTimerId: null,
  pendingCandidates: [],
  _listenersInitialized: false,

  initCallListeners: () => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    // Remove existing to prevent duplicates
    socket.off("incoming-call");
    socket.off("call-answer-forwarded");
    socket.off("ice-candidate-forwarded");
    socket.off("call-ended");
    socket.off("call-rejected");

    socket.on("incoming-call", (data) => {
      get()._handleIncomingCall(data);
    });

    socket.on("call-answer-forwarded", ({ answer }) => {
      get()._handleCallAnswer(answer);
    });

    socket.on("ice-candidate-forwarded", ({ candidate }) => {
      get()._handleRemoteIceCandidate(candidate);
    });

    socket.on("call-ended", () => {
      get()._cleanup();
    });

    socket.on("call-rejected", () => {
      get()._cleanup();
    });

    set({ _listenersInitialized: true });
  },

  startCall: async (targetUserId, name, avatar) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      const iceConfig = await fetchIceServers();
      const pc = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
      });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log("[Call] ICE connection state:", state);
        
        if (state === "connected" || state === "completed") {
          if (get().callStatus === "outgoing") {
            const timerId = setInterval(() => {
              set((s) => ({
                callDurationSeconds: s.callDurationSeconds + 1,
              }));
            }, 1000);

            const timeoutId = get()._callTimeoutId;
            if (timeoutId) clearTimeout(timeoutId);

            set({
              callStatus: "active",
              _durationTimerId: timerId,
              _callTimeoutId: null,
            });
          }
        } else if (state === "failed" || state === "disconnected") {
          console.log("[Call] ICE connection failed/disconnected — cleaning up");
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
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Same as mobile: callerName/Avatar not sent (backend looks it up)
      socket.emit("call-offer", {
        targetUserId,
        offer,
        callType: "audio",
      });

      set({ callStatus: "outgoing" });

      const timeoutId = setTimeout(() => {
        if (get().callStatus === "outgoing") {
          console.log("[Call] No answer — timing out");
          socket.emit("call-end", { targetUserId });
          get()._cleanup();
        }
      }, 60000);

      set({ _callTimeoutId: timeoutId });
    } catch (e) {
      console.error("Failed to start call:", e);
      // Depending on the browser, getUserMedia may throw an error if denied.
      get()._cleanup();
    }
  },

  acceptCall: async () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, pendingCandidates } = get();
    if (!socket || !remoteUserId) return;

    if (get()._callTimeoutId) {
      clearTimeout(get()._callTimeoutId);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      const iceConfig = await fetchIceServers();
      const pc = new RTCPeerConnection({
        iceServers: iceConfig.iceServers,
      });

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            targetUserId: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === "failed" || state === "disconnected") {
          console.log("[Call] ICE connection failed/disconnected — cleaning up");
          get()._cleanup();
        }
      };

      set({ localStream: stream, peerConnection: pc });

      const offer = get().incomingOffer;
      if (offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call-answer", {
        targetUserId: remoteUserId,
        answer,
        callId: get().callId,
      });

      for (const candidate of pendingCandidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add pending ice candidate:", e);
        }
      }
      set({ pendingCandidates: [] });

      const timerId = setInterval(() => {
        set((state) => ({
          callDurationSeconds: state.callDurationSeconds + 1,
        }));
      }, 1000);

      set({
        _durationTimerId: timerId,
        _callTimeoutId: null,
        callStatus: "active",
      });
    } catch (e) {
      console.error("Failed to accept call:", e);
      get()._cleanup();
    }
  },

  rejectCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId) {
      socket.emit("call-reject", { targetUserId: remoteUserId, callId });
    }
    get()._cleanup();
  },

  endCall: () => {
    const socket = useSocketStore.getState().socket;
    const { remoteUserId, callId } = get();
    if (socket && remoteUserId) {
      socket.emit("call-end", { targetUserId: remoteUserId, callId });
    }
    get()._cleanup();
  },

  toggleMute: () => {
    set((state) => {
      const isMuted = !state.isMuted;
      if (state.localStream) {
        state.localStream.getAudioTracks().forEach((track) => {
          track.enabled = !isMuted;
        });
      }
      return { isMuted };
    });
  },

  _handleIncomingCall: (data) => {
    if (get().callStatus !== "idle") {
      console.log("[Call] Ignored incoming call, already in a call");
      return;
    }

    set({
      callStatus: "incoming",
      remoteUserId: data.callerId,
      remoteUserName: data.callerName,
      remoteUserAvatar: data.callerAvatar,
      callType: data.callType,
      incomingOffer: data.offer,
      callId: data.callId,
      pendingCandidates: [],
    });

    const timeoutId = setTimeout(() => {
      if (get().callStatus === "incoming") {
        console.log("[Call] Missed incoming call timeout");
        get()._cleanup();
      }
    }, 60000);

    set({ _callTimeoutId: timeoutId });
  },

  _handleCallAnswer: async (answer) => {
    const { peerConnection, pendingCandidates } = get();
    if (!peerConnection) return;

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

      for (const candidate of pendingCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add pending ice candidate:", e);
        }
      }
      set({ pendingCandidates: [] });
    } catch (e) {
      console.error("Failed to handle call answer:", e);
    }
  },

  _handleRemoteIceCandidate: async (candidate) => {
    const { peerConnection, pendingCandidates } = get();

    if (peerConnection && peerConnection.remoteDescription) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Failed to add ice candidate:", e);
      }
    } else {
      set({ pendingCandidates: [...pendingCandidates, candidate] });
    }
  },

  _cleanup: () => {
    const { localStream, peerConnection, _callTimeoutId, _durationTimerId } = get();

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
    }

    if (peerConnection) {
      try {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.oniceconnectionstatechange = null;
        peerConnection.close();
      } catch (e) {
        // ignore
      }
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
      _callTimeoutId: null,
      _durationTimerId: null,
      pendingCandidates: [],
      incomingOffer: null,
    });
  },
}));
