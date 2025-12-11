import { create } from 'zustand'
import type { User } from '@/types/User'

type SettingsStore = {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  user: null,
  setUser: (user: User | null) => set({ user }),
  logout: () => set({ user: null }),
}))
