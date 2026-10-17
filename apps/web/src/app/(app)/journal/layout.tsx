export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="h-full w-full">{children}</main>;
}
