import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFirebaseAuth } from "./useFirebaseAuth";
import api from "../lib/axios";

export const useChats = () => {
  const { firebaseUser } = useFirebaseAuth();

  return useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const token = await firebaseUser.getIdToken();
      const res = await api.get("/chats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
  });
};

export const useGetOrCreateChat = () => {
  const { firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (participantId) => {
      const token = await firebaseUser.getIdToken();
      const res = await api.post(
        `/chats/with/${participantId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
};