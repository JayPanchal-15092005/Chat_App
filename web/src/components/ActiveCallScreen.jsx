import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, Volume2, User } from "lucide-react";
import { useCallStore } from "../lib/callStore";

const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function ActiveCallScreen() {
  const {
    callStatus,
    remoteUserName,
    remoteUserAvatar,
    isMuted,
    toggleMute,
    endCall,
    callDurationSeconds,
    remoteStream,
  } = useCallStore();

  const audioRef = useRef(null);

  // ── Attach remote stream to audio element ─────────────────────────────
  // This effect runs whenever remoteStream changes. Using a ref for the audio
  // element (instead of querying the DOM) ensures it's stable across renders.
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (remoteStream) {
      console.log("[WebRTC] Attaching remote stream to audio element. id=", remoteStream.id);
      console.log("[WebRTC] Audio tracks:", remoteStream.getAudioTracks().length);
      remoteStream.getAudioTracks().forEach((t) =>
        console.log(`  track id=${t.id} enabled=${t.enabled} muted=${t.muted} readyState=${t.readyState}`)
      );

      // Detach first to trigger a clean re-attach
      audioEl.srcObject = null;
      audioEl.srcObject = remoteStream;

      // Force playback — handles browsers that block autoplay
      audioEl.play().then(() => {
        console.log("[WebRTC] Audio playback started ✅");
      }).catch((err) => {
        console.error("[WebRTC] Audio play() failed:", err.name, err.message);
        // If blocked by autoplay policy, try muted first then unmute
        // (some browsers allow muted autoplay)
        if (err.name === "NotAllowedError") {
          audioEl.muted = true;
          audioEl.play().then(() => {
            audioEl.muted = false;
            console.log("[WebRTC] Audio unblocked via muted→unmuted trick");
          }).catch((e) => console.error("[WebRTC] Muted play also failed:", e));
        }
      });
    } else {
      audioEl.srcObject = null;
    }

    return () => {
      // Do NOT null srcObject here — the call might still be active
      // and cleanup should happen in _cleanup()
    };
  }, [remoteStream]);

  if (callStatus !== "active") return null;

  return (
    <div className="fixed inset-0 z-9997 flex items-center justify-center bg-black/95 backdrop-blur-xl">
      {/*
        CRITICAL: This audio element MUST stay mounted while callStatus === "active".
        Do not conditionally render it. Unmounting it clears srcObject and kills audio.
      */}
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />

      <div className="flex flex-col items-center gap-6 p-8 w-full max-w-sm">
        {/* Timer */}
        <div className="text-white/60 text-lg font-mono tracking-widest">
          {formatDuration(callDurationSeconds)}
        </div>

        {/* Avatar */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-2xl scale-125" />
          {remoteUserAvatar ? (
            <img
              src={remoteUserAvatar}
              className="w-40 h-40 rounded-full object-cover z-10 shadow-2xl border-4 border-white/10"
              alt="Remote User"
            />
          ) : (
            <div className="w-40 h-40 rounded-full bg-base-300 flex items-center justify-center z-10 shadow-2xl border-4 border-white/10">
              <User className="w-20 h-20 text-base-content/50" />
            </div>
          )}
          {/* Animated audio indicator */}
          <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <Volume2 className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Name */}
        <h3 className="text-white text-3xl font-bold">
          {remoteUserName || "Someone"}
        </h3>

        <p className="text-white/40 text-sm">Connected</p>

        {/* Controls */}
        <div className="flex items-center gap-8 mt-4">
          {/* Mute */}
          <button
            onClick={toggleMute}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
              isMuted
                ? "bg-white text-black shadow-lg scale-105"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
          </button>

          {/* End Call */}
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-xl shadow-red-500/30"
            title="End Call"
          >
            <Phone className="w-10 h-10 rotate-135" />
          </button>
        </div>
      </div>
    </div>
  );
}
