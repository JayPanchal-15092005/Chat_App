import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { useAuthStore } from "./useAuthStore";

export const useChats = () => {
  const { apiWithAuth } = useApi();
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const { data } = await apiWithAuth({ url: "/chats", method: "GET" });
      return data;
    },
    enabled: !!token,
  });
};

export const useGetOrCreateChat = () => {
  const { apiWithAuth } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (participantId) => {
      const { data } = await apiWithAuth({
        url: `/chats/with/${participantId}`,
        method: "POST",
      });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
};