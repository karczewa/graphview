import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  url: string;
  username: string;
  password: string;
  database: string;
  maxNodes: number;

  setConnection: (url: string, username: string, password: string, database: string) => void;
  setMaxNodes: (n: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      url: '',
      username: '',
      password: '',
      database: '',
      maxNodes: 500,

      setConnection: (url, username, password, database) =>
        set({ url, username, password, database }),

      setMaxNodes: (maxNodes) => set({ maxNodes }),
    }),
    { name: 'graphview-settings' },
  ),
);
