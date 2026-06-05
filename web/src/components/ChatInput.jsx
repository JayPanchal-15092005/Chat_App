import { SendIcon, XIcon, ImageIcon, MicIcon, SquareIcon } from "lucide-react";
import { useRef, useState } from "react";

export function ChatInput({ value, onChange, onSubmit, disabled, replyTo, onCancelReply, onSendMedia }) {
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    await onSendMedia("image", file);
    setIsUploading(false);
    e.target.value = ""; // reset
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setIsUploading(true);
        await onSendMedia("voice", blob);
        setIsUploading(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          {!isRecording && (
            <button
              type="button"
              onClick={handleImageClick}
              disabled={isUploading}
              className="btn btn-ghost btn-circle text-base-content/70 hover:text-amber-500"
              title="Attach Image"
            >
              <ImageIcon className="size-5" />
            </button>
          )}

          {isRecording ? (
            <div className="flex-1 flex items-center justify-center text-error font-bold bg-base-300/40 rounded-xl h-12">
              Recording... 🎤
            </div>
          ) : (
            <input
              type="text"
              value={value}
              onChange={onChange}
              disabled={isUploading}
              placeholder={isUploading ? "Uploading..." : replyTo ? "Write a reply..." : "Type a message..."}
              className="input input-bordered flex-1 rounded-xl bg-base-300/40 border-base-300 placeholder:text-base-content/60"
              onKeyDown={(e) => {
                if (e.key === "Escape" && replyTo) onCancelReply?.();
              }}
            />
          )}

          {value.trim() ? (
            <button
              type="submit"
              disabled={disabled || isUploading}
              className="btn rounded-xl bg-linear-to-r from-amber-500 to-orange-500 border-none disabled:btn-disabled text-white"
            >
              <SendIcon className="size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
              className={`btn rounded-xl border-none text-white ${
                isRecording
                  ? "bg-error hover:bg-error/80"
                  : "bg-base-300 text-base-content hover:bg-amber-500 hover:text-white"
              }`}
              title={isRecording ? "Stop Recording" : "Record Voice"}
            >
              {isRecording ? <SquareIcon className="size-5" /> : <MicIcon className="size-5" />}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}