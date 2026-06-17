import { useQuery } from "@tanstack/react-query";
import api from "../lib/axios";
import { useFirebaseAuth } from "./useFirebaseAuth";

export const useCurrentUser = () => {
  const { firebaseUser } = useFirebaseAuth();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const token = await firebaseUser.getIdToken();
      const { data } = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
  });
};