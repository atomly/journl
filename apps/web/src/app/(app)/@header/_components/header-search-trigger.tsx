import { Button } from "@acme/ui/button";
import { Search } from "lucide-react";
export function HeaderSearchTrigger(props: React.ComponentProps<"button">) {
  return (
    <Button variant="ghost" size="icon" aria-label="Search notes" {...props}>
      <Search />
    </Button>
  );
}
