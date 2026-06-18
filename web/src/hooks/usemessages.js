import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";
import { useApi } from "./useApi";
import { useAuthStore } from "./useAuthStore";

export const useMessages = (chatId) => {
  const { apiWithAuth } = useApi();
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const { data } = await apiWithAuth({
        url:  `/messages/chat/${chatId}`,
        method: "GET"
      });
      return data;
    },
    enabled: !!chatId && !!token,
  });
};