import { useCallback } from 'react';
import api from '../lib/axios';
import { useAuthStore } from './useAuthStore';

export const useApi = () => {
  const apiWithAuth = useCallback(
    async (config) => {
      // Get custom JWT from Zustand store (which gets it from localStorage)
      const token = useAuthStore.getState().token;

      // Make the actual request with Bearer token
      return api.request({
        ...config,
        headers: {
          ...config.headers,
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      });
    },
    []
  );

  return { apiWithAuth };
};
