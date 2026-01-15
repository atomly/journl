"use client";

import * as React from "react";
import { useOptimisticActionState } from "~/hooks/use-optimistic-action-state";
import {
  type AppPreferences,
  DEFAULT_APP_PREFERENCES,
  normalizeAppPreferences,
} from "~/preferences/app-preferences";
import { setAppPreferencesAction } from "./app-preferences.actions";

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  setPreferences: (
    next: AppPreferences | ((current: AppPreferences) => AppPreferences),
  ) => void;
  updatePreferences: (next: Partial<AppPreferences>) => void;
};

const AppPreferencesContext =
  React.createContext<AppPreferencesContextValue | null>(null);

type AppPreferencesProviderProps = {
  initialPreferences?: AppPreferences;
  children: React.ReactNode;
};

export function AppPreferencesProvider({
  initialPreferences,
  children,
}: AppPreferencesProviderProps) {
  const initialState = React.useMemo(
    () =>
      normalizeAppPreferences(initialPreferences ?? DEFAULT_APP_PREFERENCES),
    [initialPreferences],
  );
  const [preferences, savePreferences] = useOptimisticActionState(
    async (_current: AppPreferences, next: AppPreferences) =>
      setAppPreferencesAction(next),
    initialState,
    (
      current: AppPreferences,
      next: AppPreferences | ((current: AppPreferences) => AppPreferences),
    ) => {
      const resolved = typeof next === "function" ? next(current) : next;
      return normalizeAppPreferences(resolved);
    },
  );

  const setPreferences = React.useCallback<
    AppPreferencesContextValue["setPreferences"]
  >(
    (next) => {
      const resolved = typeof next === "function" ? next(preferences) : next;
      const normalized = normalizeAppPreferences(resolved);
      savePreferences(normalized);
    },
    [preferences, savePreferences],
  );

  const updatePreferences = React.useCallback(
    (next: Partial<AppPreferences>) => {
      setPreferences((current) => ({
        ...current,
        ...next,
      }));
    },
    [setPreferences],
  );

  const value = React.useMemo(
    () => ({
      preferences: preferences,
      setPreferences,
      updatePreferences,
    }),
    [preferences, setPreferences, updatePreferences],
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = React.useContext(AppPreferencesContext);
  if (!context) {
    throw new Error(
      "useAppPreferences must be used within AppPreferencesProvider.",
    );
  }
  return context;
}
