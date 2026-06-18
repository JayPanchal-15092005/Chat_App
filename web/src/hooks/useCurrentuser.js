import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { useAuthStore } from "./useAuthStore";

export const useCurrentUser = () => {
  const { apiWithAuth } = useApi();
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const { data } = await apiWithAuth({ url: "/auth/me", method: "GET" });
      return data;
    },
    enabled: !!token,
  });
};