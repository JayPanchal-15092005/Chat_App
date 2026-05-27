import { SendIcon, XIcon } from "lucide-react";

export function ChatInput({ value, onChange, onSubmit, disabled, replyTo, onCancelReply }) {
  return (
    <div className="border-t border-base-300">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-base-300/40 border-b border-base-300">
          <div className="w-0.5 h-8 bg-amber-500 rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-400 truncate">
              {typeof replyTo.sender === "object" ? replyTo.sender.name : "Message"}
            </p>
            <p className="text-xs text-base-content/60 truncate">{replyTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="btn btn-ghost btn-xs btn-circle"
            aria-label="Cancel reply"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input row */}
      <form onSubmit={onSubmit} className="p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={value}
            onChange={onChange}
            placeholder={replyTo ? "Write a reply..." : "Type a message..."}
            className="input input-bordered flex-1 rounded-xl bg-base-300/40 border-base-300 placeholder:text-base-content/60"
            onKeyDown={(e) => {
              if (e.key === "Escape" && replyTo) onCancelReply?.();
            }}
          />
          <button
            type="submit"
            disabled={disabled}
            className="btn rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 border-none disabled:btn-disabled text-white"
          >
            <SendIcon className="size-5" />
          </button>
        </div>
      </form>
    </div>
  );
}