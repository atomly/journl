"use client";

import * as React from "react";

export function useOptimisticActionState<State, Payload>(
  action: (current: Awaited<State>, payload: Payload) => Promise<State> | State,
  initialState: Awaited<State>,
  optimisticReducer: (
    current: Awaited<State>,
    payload: Payload,
  ) => Awaited<State>,
) {
  const [savedState, runAction, isPending] = React.useActionState<
    State,
    Payload
  >(action, initialState);
  const [optimisticState, setOptimisticState] = React.useOptimistic<
    Awaited<State>,
    Payload
  >(savedState, optimisticReducer);

  const runOptimisticAction = React.useCallback(
    (payload: Payload) => {
      React.startTransition(() => {
        setOptimisticState(payload);
        runAction(payload);
      });
    },
    [runAction, setOptimisticState],
  );

  return [optimisticState, runOptimisticAction, isPending] as const;
}
