
import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router";
import { useSocketStore } from "../lib/socket";
import { useSocketConnection } from "../hooks/useSocketConnection";
import { SparklesIcon, MessageSquareIcon, PlusIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useChats, useGetOrCreateChat } from "../hooks/useChat";
import { useMessages } from "../hooks/usemessages";
import { ChatListItem } from "../components/ChatListItem";
import { ChatHeader } from "../components/ChatHeader";
import { MessageBubble } from "../components/MessageBubble";
import { ChatInput } from "../components/ChatInput";
import { useCurrentUser } from "../hooks/useCurrentuser";
import { NewChatModal } from "../components/NewChatModel";

import { useFirebaseAuth } from "../hooks/useFirebaseAuth";
import { uploadToImageKit } from "../lib/imagekit";

function ChatPage() {
  const { data: currentUser } = useCurrentUser();
  const { firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeChatId = searchParams.get("chat");

  const [messageInput, setMessageInput] = useState("");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const { socket, setTyping, sendMessage, markDelivered, markSeen } = useSocketStore();

  // Pass activeChatId so hook can join/leave the room automatically
  useSocketConnection(activeChatId);

  const { data: chats = [], isLoading: chatsLoading } = useChats();
  const { data: messages = [], isLoading: messagesLoading } = useMessages(activeChatId);
  const startChatMutation = useGetOrCreateChat();

  // Sort pinned chats to top
  const sortedChats = [...chats].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChatId, messages]);

  // Mark delivered + seen when opening a chat
  useEffect(() => {
    if (activeChatId && socket) {
      markDelivered(activeChatId);
      markSeen(activeChatId);
    }
  }, [activeChatId, socket, markDelivered, markSeen]);

  // Mark seen on every new message arrival
  useEffect(() => {
    if (activeChatId && socket && messages.length > 0) {
      markSeen(activeChatId);
    }
  }, [messages, activeChatId, socket, markSeen]);

  const handleStartChat = (participantId) => {
    startChatMutation.mutate(participantId, {
      onSuccess: (chat) => setSearchParams({ chat: chat._id }),
    });
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeChatId || !socket || !currentUser) return;

    const text = messageInput.trim();
    sendMessage(activeChatId, text, currentUser, replyingTo?._id ?? null);
    setMessageInput("");
    setReplyingTo(null);
    setTyping(activeChatId, false);
  };

  const handleSendMedia = async (type, file) => {
    if (!activeChatId || !socket || !currentUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      const url = await uploadToImageKit(file, type, token);
      
      const text = type === "image" ? "📸 Image" : "🎤 Voice Message";
      sendMessage(activeChatId, text, currentUser, replyingTo?._id ?? null, type, url);
      setReplyingTo(null);
    } catch (err) {
      console.error("Failed to send media", err);
    }
  };

  const handleTyping = (e) => {
    setMessageInput(e.target.value);
    if (!activeChatId) return;

    setTyping(activeChatId, true);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(activeChatId, false);
    }, 2000);
  };

  const handleReply = useCallback((msg) => {
    setReplyingTo(msg);
  }, []);

  const handleTogglePin = useCallback(
    async (chat) => {
      try {
        const token = await firebaseUser.getIdToken();
        await axios.patch(
          `${import.meta.env.VITE_API_URL}/api/chats/${chat._id}/pin`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Optimistic update
        queryClient.setQueryData(["chats"], (old) =>
          old?.map((c) =>
            c._id === chat._id ? { ...c, isPinned: !c.isPinned } : c
          )
        );
      } catch (err) {
        console.error("Failed to toggle pin:", err);
      }
    },
    [firebaseUser, queryClient]
  );

  const activeChat = chats.find((c) => c._id === activeChatId);

  return (
    <div className="h-screen bg-base-100 text-base-content flex">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div className="w-80 border-r border-base-300 flex flex-col bg-base-200">
        {/* Header */}
        <div className="p-4 border-b border-base-300">
          <div className="flex items-center justify-between mb-4">
            <Link to="/chat" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold">Whisper</span>
            </Link>
            <button 
              onClick={() => useFirebaseAuth().signOut()} 
              className="btn btn-sm btn-ghost text-base-content/70"
            >
              Sign out
            </button>
          </div>
          <button
            onClick={() => setIsNewChatModalOpen(true)}
            className="btn btn-primary btn-block gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 border-none text-white"
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Pin hint */}
        <p className="text-[10px] text-base-content/30 px-4 pt-2">
          Right-click a chat to pin / unpin
        </p>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {chatsLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-sm text-amber-400" />
            </div>
          )}

          {sortedChats.length === 0 && !chatsLoading && <NoConversationsUI />}

          <div className="flex flex-col gap-1 p-2">
            {sortedChats.map((chat) => (
              <ChatListItem
                key={chat._id}
                chat={chat}
                isActive={activeChatId === chat._id}
                onClick={() => setSearchParams({ chat: chat._id })}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Chat Area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {activeChatId && activeChat ? (
          <>
            <ChatHeader participant={activeChat.participant} chatId={activeChatId} />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {messagesLoading && (
                <div className="flex items-center justify-center h-full">
                  <span className="loading loading-spinner loading-md text-amber-400" />
                </div>
              )}

              {messages.length === 0 && !messagesLoading && <NoMessagesUI />}

              {messages.length > 0 &&
                messages.map((msg) => (
                  <MessageBubble
                    key={msg._id}
                    message={msg}
                    currentUser={currentUser}
                    chatId={activeChatId}
                    onReply={handleReply}
                  />
                ))}

              <div ref={messagesEndRef} />
            </div>

            <ChatInput
              value={messageInput}
              onChange={handleTyping}
              onSubmit={handleSend}
              onSendMedia={handleSendMedia}
              disabled={!messageInput.trim()}
              replyTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </>
        ) : (
          <NoChatSelectedUI />
        )}
      </div>

      <NewChatModal
        onStartChat={handleStartChat}
        isPending={startChatMutation.isPending}
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
      />
    </div>
  );
}

export default ChatPage;

function NoConversationsUI() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <MessageSquareIcon className="w-10 h-10 text-amber-400 mb-3" />
      <p className="text-base-content/70 text-sm">No conversations yet</p>
      <p className="text-base-content/60 text-xs mt-1">Start a new chat to begin</p>
    </div>
  );
}

function NoMessagesUI() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-base-300/40 flex items-center justify-center mb-4">
        <MessageSquareIcon className="w-8 h-8 text-base-content/20" />
      </div>
      <p className="text-base-content/70">No messages yet</p>
      <p className="text-base-content/60 text-sm mt-1">Send a message to start the conversation</p>
    </div>
  );
}

function NoChatSelectedUI() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6">
        <MessageSquareIcon className="w-10 h-10 text-amber-400" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Welcome to Whisper</h2>
      <p className="text-base-content/70 max-w-sm">
        Select a conversation from the sidebar or start a new chat to begin messaging
      </p>
    </div>
  );
}