import { useEffect } from "react";
import { useAppEventEmitter } from "../components/events/app-event-context";
import type {
  AppEvent,
  AppEventClass,
  AppEventPayload,
} from "../events/app-event";

export function useEventHandler<
  P extends AppEventPayload,
  T extends AppEvent<P>,
>(
  handler: (event: T) => void,
  [EventClass, id]: [AppEventClass<P, T>, string],
): void {
  const eventEmitter = useAppEventEmitter();
  const eventType: string = EventClass.eventType;

  useEffect(() => {
    const bufferedEvent = eventEmitter.flush(eventType, id);
    if (bufferedEvent && bufferedEvent instanceof EventClass) {
      handler(bufferedEvent);
    }

    const handleLiveEvent = (event: AppEvent<AppEventPayload>): void => {
      if (
        event.type === eventType &&
        event.payload.id === id &&
        event instanceof EventClass
      ) {
        handler(event);
      }
    };

    eventEmitter.addEventListener(eventType, handleLiveEvent);
    return () => {
      eventEmitter.removeEventListener(eventType, handleLiveEvent);
    };
  }, [eventEmitter, eventType, id, handler, EventClass]);
}
