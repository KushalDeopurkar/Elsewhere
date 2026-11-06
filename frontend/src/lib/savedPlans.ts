"use client";

import { createStore } from "./clientStore";
import type { PlanResult } from "./plan";

/** Plans saved on this device (no accounts yet), newest first. */
export interface SavedPlan {
  id: string;
  prompt: string;
  savedAt: string;
  plan: PlanResult;
}

const store = createStore<SavedPlan[]>("ee.plans.v1", []);

export const useSavedPlans = () => store.useValue();

export function savePlan(prompt: string, plan: PlanResult): void {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  store.write([{ id, prompt, savedAt: new Date().toISOString(), plan }, ...store.read()].slice(0, 20));
}

export function deletePlan(id: string): void {
  store.write(store.read().filter((p) => p.id !== id));
}
