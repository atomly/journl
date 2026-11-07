"use client";
import { createContext } from "react";

/** Keep interactive chat popups inside the mobile drawer's focus scope. */
export const ChatSurfaceContext = createContext<HTMLElement | null>(null);
