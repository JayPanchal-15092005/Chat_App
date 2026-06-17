import { useQuery } from "@tanstack/react-query";
import { useFirebaseAuth } from "./useFirebaseAuth";
import api from "../lib/axios";

export const useUsers = () => {
  const { firebaseUser } = useFirebaseAuth();

  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const token = await firebaseUser.getIdToken();
      const res = await api.get("/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data;
    },
  });
};