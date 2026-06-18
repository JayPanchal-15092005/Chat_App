import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

export const useAuthStore = create((set) => ({
  token: null,
  user: null,
  isLoading: true,

  setAuth: async (token, user) => {
    try {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_data', JSON.stringify(user));
      set({ token, user, isLoading: false });
    } catch (e) {
      console.error("Failed to save auth state", e);
    }
  },

  clearAuth: async () => {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      set({ token: null, user: null, isLoading: false });
    } catch (e) {
      console.error("Failed to clear auth state", e);
    }
  },

  restoreToken: async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userData = localStorage.getItem('user_data');
      
      if (token && userData) {
        // Basic check if token is expired
        try {
           const decoded = jwtDecode(token);
           if (decoded.exp && decoded.exp * 1000 < Date.now()) {
             // Token expired
             localStorage.removeItem('auth_token');
             localStorage.removeItem('user_data');
             set({ token: null, user: null, isLoading: false });
             return;
           }
        } catch (e) {
           // Invalid token
           set({ token: null, user: null, isLoading: false });
           return;
        }

        set({ token, user: JSON.parse(userData), isLoading: false });
      } else {
        set({ token: null, user: null, isLoading: false });
      }
    } catch (e) {
      console.error("Failed to restore token", e);
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
