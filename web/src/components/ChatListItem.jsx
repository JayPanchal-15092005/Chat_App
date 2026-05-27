import { formatTime } from "../lib/utils";
import { useSocketStore } from "../lib/socket";
import { PinIcon } from "lucide-react";

export function ChatListItem({ chat, isActive, onClick, onTogglePin }) {
  const { onlineUsers, typingUsers } = useSocketStore();
  const isOnline = onlineUsers.has(chat.participant?._id);
  const isTyping = !!typingUsers.get(chat._id);
  const isPinned = !!chat.isPinned;

  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onTogglePin?.(chat);
      }}
      title={isPinned ? "Right-click to unpin" : "Right-click to pin"}
      className={`btn btn-ghost justify-start gap-3 px-4 py-8 rounded-xl w-full normal-case relative ${
        isActive ? "bg-white/10" : ""
      } ${isPinned ? "border border-amber-500/20 bg-amber-500/5" : ""}`}
    >
      {/* Pin badge */}
      {isPinned && (
        <span className="absolute top-2 right-3 text-amber-400/70" title="Pinned">
          <PinIcon className="w-3 h-3" />
        </span>
      )}

      <div className="relative">
        <img src={chat.participant?.avatar} className="w-11 h-11 rounded-full bg-base-300/40" alt="" />
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-base-200" />
        )}
      </div>

      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm truncate">
            {chat.participant?.name || "Unknown"}
          </span>
          {chat.lastMessageAt && (
            <span className="text-xs text-base-content/60">{formatTime(chat.lastMessageAt)}</span>
          )}
        </div>
        <p className="text-xs text-base-content/70 truncate mt-0.5">
          {isTyping ? (
            <span className="text-amber-400 italic">typing...</span>
          ) : (
            chat.lastMessage?.text || "No messages yet"
          )}
        </p>
      </div>
    </button>
  );
}