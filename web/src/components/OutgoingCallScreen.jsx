import { Phone, User } from "lucide-react";
import { useCallStore } from "../lib/callStore";

export function OutgoingCallScreen() {
  const { callStatus, remoteUserName, remoteUserAvatar, callType, endCall } = useCallStore();

  if (callStatus !== "outgoing") return null;

  return (
    <div className="fixed inset-0 z-9998 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="flex flex-col items-center">
        <h2 className="text-white text-xl mb-12 opacity-80">
          {callType === "video" ? "Video" : "Audio"} Call
        </h2>

        <div className="relative w-40 h-40 flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-[ping_2s_ease-in-out_infinite] opacity-40" />
          
          {remoteUserAvatar ? (
            <img 
              src={remoteUserAvatar} 
              className="w-32 h-32 rounded-full object-cover z-10" 
              alt="Callee" 
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-base-300 flex items-center justify-center z-10">
              <User className="w-16 h-16 text-base-content/50" />
            </div>
          )}
        </div>

        <h3 className="text-white text-3xl font-bold mb-4">
          {remoteUserName || "Someone"}
        </h3>

        <div className="flex items-center gap-2 mb-20 opacity-70">
          <span className="text-white text-lg">Calling</span>
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span>
          </span>
        </div>

        <button
          onClick={endCall}
          className="w-16 h-16 rounded-full bg-error hover:bg-error/90 flex items-center justify-center text-white transition-transform hover:scale-110 shadow-lg shadow-error/20"
        >
          <Phone className="w-8 h-8 rotate-135deg" />
        </button>
      </div>
    </div>
  );
}
