import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, User } from "lucide-react";
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
    remoteStream 
  } = useCallStore();
  
  const audioRef = useRef(null);

  // Attach the remote WebRTC stream to the audio element
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (callStatus !== "active") return null;

  return (
    <div className="fixed inset-0 z-9997 flex items-center justify-center bg-black/95 backdrop-blur-xl">
      {/* The remote audio stream plays here */}
      <audio ref={audioRef} autoPlay />

      <div className="flex flex-col items-center">
        <div className="text-white/60 text-lg mb-8 font-mono">
          {formatDuration(callDurationSeconds)}
        </div>

        <div className="relative w-48 h-48 flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
          
          {remoteUserAvatar ? (
            <img 
              src={remoteUserAvatar} 
              className="w-40 h-40 rounded-full object-cover z-10 shadow-2xl" 
              alt="Remote User" 
            />
          ) : (
            <div className="w-40 h-40 rounded-full bg-base-300 flex items-center justify-center z-10 shadow-2xl">
              <User className="w-20 h-20 text-base-content/50" />
            </div>
          )}
        </div>

        <h3 className="text-white text-3xl font-bold mb-16">
          {remoteUserName || "Someone"}
        </h3>

        <div className="flex items-center gap-10">
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isMuted 
                ? "bg-white text-black" 
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-error hover:bg-error/90 flex items-center justify-center text-white transition-transform hover:scale-105 shadow-lg shadow-error/20"
          >
            <Phone className="w-10 h-10 rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}
