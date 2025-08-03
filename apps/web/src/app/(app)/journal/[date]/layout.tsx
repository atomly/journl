type AppLayoutProps = {
	children: React.ReactNode;
};

export default function JournalEntryLayout({ children }: AppLayoutProps) {
	return <main className="min-h-full w-full">{children}</main>;
}
