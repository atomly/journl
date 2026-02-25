"use client";

import { useCallback, useEffect } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import { useAppLayout } from "../../../_components/app-layout-provider";

type AppContainerProps = React.ComponentProps<"div">;

export function AppContainer({ children, ...props }: AppContainerProps) {
  const isMobile = useIsMobile();
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
      {isMobile && <div className="-z-1000 h-14 shrink-0" />}
      {children}
    </div>
  );
}
