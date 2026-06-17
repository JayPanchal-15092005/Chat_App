import { useFirebaseAuth } from "./useFirebaseAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import api from "../lib/axios";

function useUserSync() {
  const { isSignedIn, firebaseUser } = useFirebaseAuth();
  const queryClient = useQueryClient();
  const hasSynced = useRef(false);

  const {
    mutate: syncUser,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async () => {
      const token = await firebaseUser.getIdToken();
      const res = await api.post(
        "/auth/callback",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    }
  });

  useEffect(() => {
    if (isSignedIn && firebaseUser && !isPending && !isSuccess && !hasSynced.current) {
      hasSynced.current = true;
      syncUser(undefined, {
        onError: () => {
          hasSynced.current = false;
        }
      });
    }
    
    if (!isSignedIn) {
      hasSynced.current = false;
    }
  }, [isSignedIn, firebaseUser, syncUser, isPending, isSuccess]);

  return { isSynced: isSuccess, isSyncing: isPending };
}

export default useUserSync;