import { useEffect } from "react";
import { useAuthStore } from "./useAuthStore";
import { useQueryClient } from "@tanstack/react-query";
import { useSocketStore } from "../lib/socket";
import { useCallStore } from "../lib/callStore";

export const useSocketConnection = (activeChatId) => {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const { socket, connect, disconnect, joinChat, leaveChat } = useSocketStore();

  // connect socket on mount
  useEffect(() => {
    if (token) {
      connect(token, queryClient);
      if (!useCallStore.getState()._listenersInitialized) {
        useCallStore.getState().initCallListeners();
      }
    } else {
      useCallStore.getState()._cleanup();
      disconnect();
    }

    return () => {
      useCallStore.getState()._cleanup();
      disconnect();
    };
  }, [token, connect, disconnect, queryClient]);

  // join/leave chat rooms - if you have a chatid in the url this will run
  useEffect(() => {
    if (activeChatId && socket) {
      joinChat(activeChatId);
      return () => leaveChat(activeChatId);
    }
  }, [activeChatId, socket, joinChat, leaveChat]);
};