"use client";

import { createContext, useContext, useMemo, useState } from "react";

type LayoutContextValue = {
	sidebarOpen: boolean;
	setSidebarOpen: (sidebarOpen: boolean) => void;
};

const LayoutContext = createContext<LayoutContextValue>({
	setSidebarOpen: () => {},
	sidebarOpen: false,
});

type LayoutProviderProps = {
	children: React.ReactNode;
	defaultValue: Omit<LayoutContextValue, "setSidebarOpen">;
};

export function LayoutProvider({
	children,
	defaultValue,
}: LayoutProviderProps) {
	const [sidebarOpen, setSidebarOpen] = useState(defaultValue.sidebarOpen);

	const value = useMemo(
		() => ({
			setSidebarOpen,
			sidebarOpen,
		}),
		[sidebarOpen],
	);

	return (
		<LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
	);
}

export function useLayout() {
	const value = useContext(LayoutContext);

	if (!value) {
		throw new Error(
			"useJournalNavbar must be used within a JournalNavbarProvider",
		);
	}

	return value;
}
