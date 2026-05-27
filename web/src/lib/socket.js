import { create } from "zustand";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL;

export const useSocketStore = create((set, get) => ({
  socket: null,
  onlineUsers: new Set(),
  typingUsers: new Map(), // chatId -> userId
  queryClient: null,

  connect: (token, queryClient) => {
    const existingSocket = get().socket;
    if (existingSocket?.connected || !queryClient) return;
    if (existingSocket) existingSocket.disconnect();

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socket.on("socket-error", (error) => {
      console.error("Socket error:", error);
    });

    socket.on("online-users", ({ userIds }) => {
      set({ onlineUsers: new Set(userIds) });
    });

    socket.on("user-online", ({ userId }) => {
      set((state) => ({ onlineUsers: new Set([...state.onlineUsers, userId]) }));
    });

    socket.on("user-offline", ({ userId }) => {
      set((state) => {
        const onlineUsers = new Set(state.onlineUsers);
        onlineUsers.delete(userId);
        return { onlineUsers };
      });
    });

    socket.on("typing", ({ userId, chatId, isTyping }) => {
      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        if (isTyping) typingUsers.set(chatId, userId);
        else typingUsers.delete(chatId);
        return { typingUsers };
      });
    });

    // ── New message ──────────────────────────────────────────────────
    socket.on("new-message", (message) => {
      const senderId = message.sender?._id;

      queryClient.setQueryData(["messages", message.chat], (old) => {
        if (!old) return [message];
        const filtered = old.filter((m) => !m._id.startsWith("temp-"));
        const exists = filtered.some((m) => m._id === message._id);
        return exists ? filtered : [...filtered, message];
      });

      queryClient.setQueryData(["chats"], (oldChats) => {
        return oldChats?.map((chat) => {
          if (chat._id === message.chat) {
            return {
              ...chat,
              lastMessage: {
                _id: message._id,
                text: message.text,
                sender: senderId,
                createdAt: message.createdAt,
              },
              lastMessageAt: message.createdAt,
            };
          }
          return chat;
        });
      });

      set((state) => {
        const typingUsers = new Map(state.typingUsers);
        typingUsers.delete(message.chat);
        return { typingUsers };
      });
    });

    // ── Message status (sent → delivered → seen) ─────────────────────
    socket.on("message-status-update", ({ chatId, status }) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return old;
        return old.map((m) => {
          if (!m._id.startsWith("temp-")) {
            if (status === "seen" && (m.status === "sent" || m.status === "delivered")) {
              return { ...m, status: "seen" };
            }
            if (status === "delivered" && m.status === "sent") {
              return { ...m, status: "delivered" };
            }
          }
          return m;
        });
      });
    });

    // ── Reaction update ──────────────────────────────────────────────
    socket.on("message-reaction-update", ({ messageId, chatId, reactions }) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return old;
        return old.map((m) => (m._id === messageId ? { ...m, reactions } : m));
      });
    });

    // ── Message edited ───────────────────────────────────────────────
    socket.on("message-edited", ({ messageId, chatId, text, isEdited }) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return old;
        return old.map((m) => (m._id === messageId ? { ...m, text, isEdited } : m));
      });
    });

    // ── Message deleted ──────────────────────────────────────────────
    socket.on("message-deleted", ({ messageId, chatId }) => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return old;
        return old.filter((m) => m._id !== messageId);
      });
    });

    set({ socket, queryClient });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, onlineUsers: new Set(), typingUsers: new Map(), queryClient: null });
    }
  },

  joinChat: (chatId) => {
    get().socket?.emit("join-chat", chatId);
  },

  leaveChat: (chatId) => {
    get().socket?.emit("leave-chat", chatId);
  },

  markDelivered: (chatId) => {
    get().socket?.emit("message-delivered", { chatId });
  },

  markSeen: (chatId) => {
    get().socket?.emit("message-seen", { chatId });
  },

  sendMessage: (chatId, text, currentUser, replyToId = null) => {
    const { socket, queryClient } = get();
    if (!socket?.connected || !queryClient) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      chat: chatId,
      sender: {
        _id: currentUser._id,
        name: currentUser.fullName || currentUser.firstName || "You",
        email: currentUser.primaryEmailAddress?.emailAddress || "",
        avatar: currentUser.imageUrl,
      },
      text,
      type: "text",
      status: "sent",
      replyTo: null,
      reactions: [],
      isEdited: false,
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData(["messages", chatId], (old) => {
      if (!old) return [optimisticMessage];
      return [...old, optimisticMessage];
    });

    socket.emit("send-message", { chatId, text, replyToId });

    socket.once("socket-error", () => {
      queryClient.setQueryData(["messages", chatId], (old) => {
        if (!old) return [];
        return old.filter((m) => m._id !== tempId);
      });
    });
  },

  reactToMessage: (messageId, chatId, emoji) => {
    get().socket?.emit("react-message", { messageId, chatId, emoji });
  },

  editMessage: (messageId, chatId, text) => {
    get().socket?.emit("edit-message", { messageId, chatId, text });
  },

  deleteMessage: (messageId, chatId) => {
    get().socket?.emit("delete-message", { messageId, chatId });
  },

  setTyping: (chatId, isTyping) => {
    get().socket?.emit("typing", { chatId, isTyping });
  },
}));