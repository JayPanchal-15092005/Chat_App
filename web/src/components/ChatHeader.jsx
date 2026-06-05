import { Phone } from "lucide-react";
import { useSocketStore } from "../lib/socket";
import { useCallStore } from "../lib/callStore";

export function ChatHeader({ participant, chatId }) {
  const { onlineUsers, typingUsers } = useSocketStore();
  const isOnline = onlineUsers.has(participant?._id);
  // const isTyping = !!typingUsers.get(chatId);
  const typingUserId = typingUsers.get(chatId);
  const isTyping = typingUserId && typingUserId === participant?._id;

  const { startCall } = useCallStore();

  return (
    <div className="h-16 px-6 border-b border-base-300 flex items-center justify-between bg-base-200/80">
      <div className="flex items-center gap-4">
      <div className="relative">
        <img src={participant?.avatar} className="w-10 h-10 rounded-full bg-base-300/40" alt="" />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-base-200" />
        )}
      </div>
      <div>
        <h2 className="font-semibold">{participant?.name}</h2>
        <p className="text-xs text-base-content/70">
          {isTyping ? "typing..." : isOnline ? "Online" : "Offline"}
        </p>
      </div>
      </div>

      <button
        onClick={() => startCall(participant._id, participant.name, participant.avatar)}
        className="btn btn-circle btn-ghost text-primary hover:bg-primary/10"
        title="Start Audio Call"
      >
        <Phone className="w-5 h-5" />
      </button>
    </div>
  );
}