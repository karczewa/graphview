import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  url: string;
  username: string;
  password: string;
  database: string;
  maxNodes: number;
  isDark: boolean;

  setConnection: (url: string, username: string, password: string, database: string) => void;
  setMaxNodes: (n: number) => void;
  toggleTheme: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      url: '',
      username: '',
      password: '',
      database: '',
      maxNodes: 500,
      isDark: true,

      setConnection: (url, username, password, database) =>
        set({ url, username, password, database }),

      setMaxNodes: (maxNodes) => set({ maxNodes }),

      toggleTheme: () => set((s) => ({ isDark: !s.isDark })),
    }),
    {
      name: 'graphview-settings',
      // Never persist the password — users re-enter it each session
      partialize: (s) => ({ url: s.url, username: s.username, database: s.database, maxNodes: s.maxNodes, isDark: s.isDark }),
    },
  ),
);
