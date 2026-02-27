"use client";

import { useCallback, useEffect } from "react";
import { useAppLayout } from "../../../_components/app-layout-provider";

type AppContainerProps = React.ComponentProps<"div">;

export function AppContainer({ children, ...props }: AppContainerProps) {
  const { setScrollElement } = useAppLayout();

  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      setScrollElement(node);
    },
    [setScrollElement],
  );

  useEffect(() => {
    return () => {
      setScrollElement(null);
    };
  }, [setScrollElement]);

  return (
    <div ref={handleRef} {...props}>
      {children}
    </div>
  );
}
