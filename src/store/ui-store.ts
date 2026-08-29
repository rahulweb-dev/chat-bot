import { create } from "zustand";

interface UIStore {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  mobileNavOpen: false,
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
}));
