import { AvatarFallback } from "~/components/ui/avatar";

type AppSidebarUserInformationProps = {
  name?: string | null;
};

type AppSidebarUserEmailProps = {
  email?: string | null;
};

export function AppSidebarUserInformation({
  name,
}: AppSidebarUserInformationProps) {
  return (
    <AvatarFallback className="rounded-lg">{name?.charAt(0)}</AvatarFallback>
  );
}

export function AppSidebarUsername({ name }: AppSidebarUserInformationProps) {
  return <span className="truncate font-medium">{name}</span>;
}

export function AppSidebarUserEmail({ email }: AppSidebarUserEmailProps) {
  return <span className="truncate text-xs">{email}</span>;
}
