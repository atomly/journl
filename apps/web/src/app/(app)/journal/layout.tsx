import { JournalDraftsProvider } from "./_components/journal-drafts-provider";

type AppLayoutProps = {
  children: React.ReactNode;
};

function JournalLayout({ children }: AppLayoutProps) {
  return (
    <JournalDraftsProvider>
      <main className="h-full w-full">{children}</main>
    </JournalDraftsProvider>
  );
}

export default JournalLayout;
