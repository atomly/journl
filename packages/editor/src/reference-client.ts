import type { ReferenceClient } from "@acme/references";
import { createContext } from "react";
export const ReferenceClientContext = createContext<ReferenceClient | null>(
  null,
);
