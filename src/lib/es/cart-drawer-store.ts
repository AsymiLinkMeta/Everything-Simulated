import { create } from "zustand";

/** Open/closed state of the site-wide cart drawer (opened from the header or after adding a part). */
export const useCartDrawer = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));
