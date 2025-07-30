"use client";
import { createContext, useContext, useMemo, useState } from "react";

const AuthModalContext = createContext<
	| {
			cancelUrl: string;
			setCancelUrl: (url: string) => void;
	  }
	| undefined
>(undefined);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
	const [cancelUrl, setCancelUrl] = useState("/");

	const value = useMemo(
		() => ({
			cancelUrl,
			setCancelUrl,
		}),
		[cancelUrl],
	);

	return (
		<AuthModalContext.Provider value={value}>
			{children}
		</AuthModalContext.Provider>
	);
}

export function useAuthModal() {
	const context = useContext(AuthModalContext);
	if (!context) {
		throw new Error("useAuthModal must be used within an AuthModalProvider");
	}
	return context;
}
