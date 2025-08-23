type AppLayoutProps = {
  children: React.ReactNode;
};

function JournalLayout({ children }: AppLayoutProps) {
  return <main className="h-full w-full">{children}</main>;
}

export default JournalLayout;
