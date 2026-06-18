import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";

export const useMessages = (chatId) => {
  const { firebaseUser } = useFirebaseAuth();

  return useQuery({
    queryKey: ["messages", chatId],
    queryFn: async () => {
      const token = await firebaseUser.getIdToken();
      const res = await api.get(`/messages/chat/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
    enabled: !!chatId,
  });
};