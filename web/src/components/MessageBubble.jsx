import { useState, useRef, useEffect } from "react";
import { formatTime } from "../lib/utils";
import { useSocketStore } from "../lib/socket";

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

export function MessageBubble({ message, currentUser, chatId, onReply }) {
  const isMe = message.sender?._id === currentUser?._id;
  const { reactToMessage, editMessage, deleteMessage } = useSocketStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);

  const menuRef = useRef(null);
  const editInputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowReactions(false);
      }
    };
    if (showMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  // Focus edit input
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Group reactions
  const groupedReactions = (message.reactions ?? []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const myReaction = (message.reactions ?? []).find(
    (r) => r.userId === currentUser?._id
  );

  const canEdit =
    isMe &&
    !message._id.startsWith("temp-") &&
    Date.now() - new Date(message.createdAt).getTime() < 15 * 60 * 1000;

  const isSending = message._id.startsWith("temp-");

  // ── Status ticks ─────────────────────────────────────────────────
  const StatusTick = () => {
    if (!isMe) return null;
    if (isSending) {
      return <span className="text-[10px] opacity-60 ml-1">🕐</span>;
    }
    if (message.status === "seen") {
      return (
        <span className="ml-1 text-sky-400 text-xs font-bold" title="Seen">✓✓</span>
      );
    }
    if (message.status === "delivered") {
      return (
        <span className="ml-1 opacity-60 text-xs font-bold" title="Delivered">✓✓</span>
      );
    }
    return (
      <span className="ml-1 opacity-50 text-xs font-bold" title="Sent">✓</span>
    );
  };

  // ── Handlers ─────────────────────────────────────────────────────
  const handleReact = (emoji) => {
    reactToMessage(message._id, chatId, emoji);
    setShowReactions(false);
    setShowMenu(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.text) {
      editMessage(message._id, chatId, trimmed);
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (window.confirm("Delete this message?")) {
      deleteMessage(message._id, chatId);
    }
  };

  return (
    <div className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
      {/* Bubble row */}
      <div
        className="relative group"
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(true);
          setShowReactions(false);
        }}
      >
        <div
          className={`max-w-md lg:max-w-lg xl:max-w-xl rounded-2xl px-4 py-2.5 relative ${
            isMe
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-br-sm"
              : "bg-base-300/60 text-base-content rounded-bl-sm"
          }`}
        >
          {/* Reply quote */}
          {message.replyTo && (
            <div
              className={`flex mb-2 rounded-lg overflow-hidden text-sm ${
                isMe ? "bg-black/20" : "bg-base-100/60"
              }`}
            >
              <div className="w-1 bg-amber-400 shrink-0" />
              <div className="px-3 py-2 min-w-0">
                <p className="font-semibold text-xs text-amber-400 truncate">
                  {typeof message.replyTo.sender === "object"
                    ? message.replyTo.sender.name
                    : "Message"}
                </p>
                <p
                  className={`text-xs truncate mt-0.5 ${
                    isMe ? "text-white/70" : "text-base-content/60"
                  }`}
                >
                  {message.replyTo.text}
                </p>
              </div>
            </div>
          )}

          {/* Message text / edit mode */}
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-2 min-w-[200px]">
              <textarea
                ref={editInputRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="textarea textarea-xs bg-black/20 text-white border-white/30 resize-none w-full rounded-lg text-sm"
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) handleEditSubmit(e);
                  if (e.key === "Escape") setIsEditing(false);
                }}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn btn-xs btn-ghost text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-xs bg-white/20 text-white border-none hover:bg-white/30"
                  disabled={!editText.trim()}
                >
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm leading-relaxed break-words">{message.text}</p>
          )}

          {/* Footer: time + edited + tick */}
          {!isEditing && (
            <div
              className={`flex items-center gap-1 mt-1 ${
                isMe ? "justify-end" : "justify-start"
              }`}
            >
              {message.isEdited && (
                <span
                  className={`text-[10px] italic ${
                    isMe ? "text-white/60" : "text-base-content/50"
                  }`}
                >
                  Edited
                </span>
              )}
              <span
                className={`text-[10px] ${
                  isMe ? "text-white/70" : "text-base-content/50"
                }`}
              >
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <StatusTick />
            </div>
          )}
        </div>

        {/* Hover quick-react button */}
        {!isSending && (
          <button
            onClick={() => {
              setShowReactions(true);
              setShowMenu(true);
            }}
            className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
              bg-base-300 hover:bg-base-200 border border-base-content/10 rounded-full w-7 h-7
              flex items-center justify-center text-base z-10
              ${isMe ? "-left-9" : "-right-9"}`}
            title="React"
          >
            😊
          </button>
        )}

        {/* Context menu (right-click) */}
        {showMenu && (
          <div
            ref={menuRef}
            className={`absolute z-50 top-0 ${
              isMe ? "right-full mr-2" : "left-full ml-2"
            } bg-base-200 border border-base-300 rounded-xl shadow-xl min-w-[170px] py-1.5 overflow-hidden`}
          >
            {showReactions ? (
              <div className="flex gap-1 px-2 py-1.5">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`text-xl hover:scale-125 transition-transform p-1 rounded-full ${
                      myReaction?.emoji === emoji ? "bg-amber-500/20" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-base-300 text-left"
                  onClick={() => setShowReactions(true)}
                >
                  <span>😊</span> React
                </button>
                <button
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-base-300 text-left"
                  onClick={() => {
                    setShowMenu(false);
                    onReply?.(message);
                  }}
                >
                  <span>↩️</span> Reply
                </button>
                {canEdit && (
                  <button
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-base-300 text-left"
                    onClick={() => {
                      setShowMenu(false);
                      setEditText(message.text);
                      setIsEditing(true);
                    }}
                  >
                    <span>✏️</span> Edit
                  </button>
                )}
                <div className="divider my-0.5 h-px bg-base-300 mx-3" />
                {isMe && (
                  <button
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-base-300 text-error text-left"
                    onClick={handleDelete}
                  >
                    <span>🗑️</span> Delete
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Reaction bubbles */}
      {Object.keys(groupedReactions).length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {Object.entries(groupedReactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border transition
                ${
                  myReaction?.emoji === emoji
                    ? "border-amber-500 bg-amber-500/20 text-amber-400"
                    : "border-base-content/20 bg-base-300/40 hover:bg-base-300"
                }`}
            >
              <span>{emoji}</span>
              {count > 1 && (
                <span className="text-xs text-base-content/60 font-semibold">{count}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}