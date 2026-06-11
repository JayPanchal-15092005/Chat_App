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

  // ─────────────────────────────────────────────────────────────────────────────
  // CRITICAL FIX — HTMLAudioElement
  // Attach remote stream to persistent audio element
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioRef.current) return;
    
    // Always ensure autoplay is true
    audioRef.current.autoplay = true;

    if (remoteStream) {
      console.log("[WebRTC] Attaching remote stream to HTMLAudioElement");
      
      const audioTracks = remoteStream.getAudioTracks();
      console.log("[WebRTC] Remote Audio Tracks:", audioTracks.length);
      audioTracks.forEach((t) => 
        console.log(`  track id=${t.id} enabled=${t.enabled} muted=${t.muted}`)
      );

      // Force detach before re-attaching
      audioRef.current.srcObject = null;
      audioRef.current.srcObject = remoteStream;

      const playAudio = async () => {
        try {
          await audioRef.current.play();
          console.log("[WebRTC] Remote audio playing ✅");
        } catch (err) {
          console.error("[WebRTC] Audio play failed:", err);
          // AUTOPLAY POLICY FIX
          if (err.name === "NotAllowedError") {
            console.warn("[WebRTC] Autoplay blocked. Trying muted playback...");
            audioRef.current.muted = true;
            try {
              await audioRef.current.play();
              audioRef.current.muted = false; // Unmute after play
              console.log("[WebRTC] Audio unlocked via muted trick");
            } catch (e) {
              console.error("[WebRTC] Muted play also failed:", e);
            }
          }
        }
      };

      playAudio();
    } else {
      audioRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // ─────────────────────────────────────────────────────────────────────────────
  // IMPORTANT: The audio element MUST stay mounted permanently.
  // It is rendered at the root level of this component, and only the UI
  // is conditionally rendered based on callStatus.
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      <audio
        ref={audioRef}
        autoPlay
        playsInline
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />

      {callStatus === "active" && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/95 backdrop-blur-xl">
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
                  alt={remoteUserName || "Remote User"}
                />
              ) : (
                <div className="w-40 h-40 rounded-full bg-base-300 flex items-center justify-center z-10 shadow-2xl border-4 border-white/10">
                  <User className="w-20 h-20 text-base-content/50" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg z-20">
                <Volume2 className="w-5 h-5 text-white" />
              </div>
            </div>

            {/* Name */}
            <h3 className="text-white text-3xl font-bold">
              {remoteUserName || "Someone"}
            </h3>
            <p className="text-white/40 text-sm tracking-widest uppercase">Connected</p>

            {/* Controls */}
            <div className="flex items-center gap-10 mt-4">
              {/* Mute */}
              <button
                onClick={toggleMute}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isMuted
                    ? "bg-white text-black shadow-lg"
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
                <Phone className="w-10 h-10 rotate-[135deg]" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
