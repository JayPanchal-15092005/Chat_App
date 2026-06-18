import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";
import { useAuthStore } from "./useAuthStore";

export const useUsers = () => {
  const { apiWithAuth } = useApi();
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await apiWithAuth({ url: "/users", method: "GET" });
      return data;
    },
    enabled: !!token,
  });
};