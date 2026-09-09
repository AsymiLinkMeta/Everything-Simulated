import { create } from "zustand";
import { persist } from "zustand/middleware";
import { PACKAGES } from "./catalog";
import { checkCart } from "./checkCart";
import type { CartLine, CheckResult } from "./types";

type CartState = {
  lines: CartLine[];
  driverWeightKg: number;
  postcode: string;
  setWeight: (kg: number) => void;
  setPostcode: (v: string) => void;
  loadPackage: (slug: string) => void;
  setQty: (sku: string, qty: number) => void;
  add: (sku: string) => void;
  remove: (sku: string) => void;
  setLines: (lines: CartLine[]) => void;
  clear: () => void;
  result: () => CheckResult;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      driverWeightKg: 80,
      postcode: "4215",
      setWeight: (driverWeightKg) => set({ driverWeightKg }),
      setPostcode: (postcode) => set({ postcode }),
      loadPackage: (slug) => {
        const pack = PACKAGES.find((p) => p.slug === slug);
        if (pack) set({ lines: pack.lines.map((l) => ({ ...l })) });
      },
      setQty: (sku, qty) =>
        set({
          lines: get()
            .lines.map((l) => (l.sku === sku ? { ...l, qty } : l))
            .filter((l) => l.qty > 0),
        }),
      add: (sku) => {
        const lines = [...get().lines];
        const i = lines.findIndex((l) => l.sku === sku);
        if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + 1 };
        else lines.push({ sku, qty: 1 });
        set({ lines });
      },
      remove: (sku) => set({ lines: get().lines.filter((l) => l.sku !== sku) }),
      setLines: (lines) => set({ lines: lines.map((l) => ({ ...l })) }),
      clear: () => set({ lines: [] }),
      result: () => checkCart({ lines: get().lines, driverWeightKg: get().driverWeightKg, postcode: get().postcode }),
    }),
    { name: "es-cart-v2" }
  ),
);
