"use client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface JudgeState {
  on: boolean;
  set: (on: boolean) => void;
  toggle: () => void;
}

/** Judge mode: persisted in localStorage; `?judge=1` turns it on (see JudgeModeFromUrl). */
export const useJudge = create<JudgeState>()(
  persist(
    (set, get) => ({
      on: false,
      set: (on) => set({ on }),
      toggle: () => set({ on: !get().on }),
    }),
    { name: "nf-judge-mode", storage: createJSONStorage(() => localStorage) },
  ),
);
