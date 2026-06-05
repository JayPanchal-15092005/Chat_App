import { useEffect, useRef } from "react";
import { Phone, PhoneOff, User } from "lucide-react";
import { useCallStore } from "../lib/callStore";

export function IncomingCallModal() {
  const { callStatus, remoteUserName, remoteUserAvatar, callType, acceptCall, rejectCall } = useCallStore();
  const audioRef = useRef(null);

  useEffect(() => {
    if (callStatus === "incoming") {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
      if ("vibrate" in navigator) {
        navigator.vibrate([500, 1000, 500, 1000, 500, 1000]);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if ("vibrate" in navigator) {
        navigator.vibrate(0);
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ("vibrate" in navigator) {
        navigator.vibrate(0);
      }
    };
  }, [callStatus]);

  if (callStatus !== "incoming") return null;

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/85 backdrop-blur-sm">
      {/* Placeholder ringtone. Ensure you place a ringtone.mp3 in the public folder. */}
      <audio ref={audioRef} src="/ringtone.mp3" loop />
      
      <div className="flex flex-col items-center">
        <h2 className="text-white text-xl mb-10 opacity-80">
          Incoming {callType === "video" ? "Video" : "Audio"} Call
        </h2>

        <div className="relative w-36 h-36 flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-[ping_1.5s_ease-in-out_infinite] opacity-50" />
          <div className="absolute inset-2 rounded-full border-2 border-primary animate-[ping_1.5s_ease-in-out_infinite_0.3s] opacity-30" />
          
          {remoteUserAvatar ? (
            <img 
              src={remoteUserAvatar} 
              className="w-32 h-32 rounded-full object-cover z-10" 
              alt="Caller" 
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-base-300 flex items-center justify-center z-10">
              <User className="w-16 h-16 text-base-content/50" />
            </div>
          )}
        </div>

        <h3 className="text-white text-3xl font-bold mb-16">
          {remoteUserName || "Someone"}
        </h3>

        <div className="flex items-center gap-16">
          <button
            onClick={rejectCall}
            className="w-16 h-16 rounded-full bg-error hover:bg-error/90 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-error/20"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
          
          <button
            onClick={acceptCall}
            className="w-16 h-16 rounded-full bg-success hover:bg-success/90 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-success/20 animate-bounce"
          >
            <Phone className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
}
