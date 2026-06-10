import { SendIcon, XIcon, ImageIcon, MicIcon, SquareIcon, TrashIcon } from "lucide-react";
import { useRef, useState } from "react";

export function ChatInput({ value, onChange, onSubmit, disabled, replyTo, onCancelReply, onSendMedia }) {
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { file, previewUrl }
  const [pendingVoice, setPendingVoice] = useState(null); // Blob

  // ── Image picker ──────────────────────────────────────────────────────────
  const handleImageClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview instead of immediately uploading
    const previewUrl = URL.createObjectURL(file);
    setPendingImage({ file, previewUrl });
    e.target.value = ""; // reset so same file can be reselected
  };

  const handleSendImage = async () => {
    if (!pendingImage) return;
    setIsUploading(true);
    try {
      await onSendMedia("image", pendingImage.file);
    } finally {
      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
      setIsUploading(false);
    }
  };

  const handleCancelImage = () => {
    URL.revokeObjectURL(pendingImage?.previewUrl);
    setPendingImage(null);
  };

  // ── Voice recorder ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setPendingVoice(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
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

  const handleSendVoice = async () => {
    if (!pendingVoice) return;
    setIsUploading(true);
    try {
      await onSendMedia("voice", pendingVoice);
    } finally {
      setPendingVoice(null);
      setIsUploading(false);
    }
  };

  const handleDiscardVoice = () => setPendingVoice(null);

  // ── Render ────────────────────────────────────────────────────────────────
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

      {/* ── Image Preview ─────────────────────────────────────────────── */}
      {pendingImage && (
        <div className="flex items-center gap-4 px-4 py-3 bg-base-300/60 border-b border-base-300">
          <div className="relative">
            <img
              src={pendingImage.previewUrl}
              alt="Preview"
              className="w-20 h-20 rounded-xl object-cover border border-base-300"
            />
          </div>
          <p className="flex-1 text-sm text-base-content/70">Ready to send</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelImage}
              className="btn btn-ghost btn-sm btn-circle"
              title="Cancel"
            >
              <XIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendImage}
              disabled={isUploading}
              className="btn btn-sm rounded-xl bg-amber-500 hover:bg-amber-600 border-none text-white"
            >
              {isUploading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <SendIcon className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Voice Preview ─────────────────────────────────────────────── */}
      {pendingVoice && !pendingImage && (
        <div className="flex items-center gap-4 px-4 py-3 bg-base-300/60 border-b border-base-300">
          <div className="flex-1 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <MicIcon className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-sm text-base-content/70">Voice message recorded</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscardVoice}
              className="btn btn-ghost btn-sm btn-circle text-error"
              title="Discard"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleSendVoice}
              disabled={isUploading}
              className="btn btn-sm rounded-xl bg-amber-500 hover:bg-amber-600 border-none text-white"
            >
              {isUploading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  <SendIcon className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Normal input row (hidden when preview is active) ──────────── */}
      {!pendingImage && !pendingVoice && (
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
              <div className="flex-1 flex items-center justify-center text-error font-bold bg-base-300/40 rounded-xl h-12 gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse" />
                Recording...
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
      )}
    </div>
  );
}