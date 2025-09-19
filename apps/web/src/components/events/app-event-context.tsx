import { createContext, useContext, useRef } from "react";
import type { AppEventPayload } from "../../events/app-event";
import { AppEventEmitter } from "../../events/app-event-emitter";

const AppEventContext = createContext<AppEventEmitter<AppEventPayload> | null>(
  null,
);

export function AppEventProvider({ children }: { children: React.ReactNode }) {
  const eventEmitter = useRef(new AppEventEmitter<AppEventPayload>());

  return (
    <AppEventContext.Provider value={eventEmitter.current}>
      {children}
    </AppEventContext.Provider>
  );
}

export function useAppEventEmitter() {
  const eventEmitter = useContext(AppEventContext);
  if (!eventEmitter) {
    throw new Error(
      "useAppEventEmitter must be used within an AppEventProvider",
    );
  }
  return eventEmitter;
}
