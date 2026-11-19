"use client";

import { Button } from "@acme/ui/button";
import { Calendar } from "@acme/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@acme/ui/popover";
import { Surface } from "@acme/ui/surface";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, MoreHorizontal, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import {
  useIsMobile,
  useShellReady,
  useShellViewport,
} from "~/components/ui/use-shell-viewport";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { useTRPC } from "~/trpc/react";
import { useNavigationSidebar } from "../../@appSidebar/_components/app-sidebar-provider";

function RouteDisclosure({
  open,
  onOpenChange,
  label,
  title,
  trigger,
  children,
  align = "start",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  label: string;
  title: string;
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const mobile = useIsMobile();
  const ready = useShellReady();
  if (mobile)
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger render={trigger} aria-label={label} disabled={!ready} />
        <DialogContent
          data-shell-menu
          className="flex max-h-[65dvh] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0"
        >
          <Surface
            material="glass"
            className="flex min-h-[70px] shrink-0 items-center rounded-none border-x-0 border-t-0 p-4 pr-16"
          >
            <DialogHeader className="text-left">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          </Surface>
          <div className="flex min-h-0 flex-col gap-1 overflow-auto p-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger render={trigger} aria-label={label} disabled={!ready} />
      <PopoverContent
        align={align}
        data-shell-route-popover
        className="max-h-[min(65dvh,var(--available-height,65dvh))] gap-0 overflow-hidden rounded-[20px] p-0"
      >
        <Surface
          material="glass"
          className="flex min-h-[70px] shrink-0 items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3"
        >
          <PopoverTitle className="font-semibold text-base">
            {title}
          </PopoverTitle>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close route menu"
            className="size-11 shrink-0 [&>svg]:size-5"
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
          </Button>
        </Surface>
        <div className="flex min-h-0 flex-col gap-1 overflow-auto p-4 [&>button]:min-h-11">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function HeaderRouteActions({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useNavigationSidebar();
  const viewport = useShellViewport();
  const router = useRouter();
  const trpc = useTRPC();
  const agent = useJournlAgent();
  const currentTitle = useSyncExternalStore(
    agent.subscribe,
    () => {
      const view = agent.getView();
      return view.name === "page" && agent.getEditors().has(`page:${view.id}`)
        ? view.title
        : null;
    },
    () => null,
  );
  const [browseDates, setBrowseDates] = useState(false);
  const [open, setOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const closeMenus = () => {
    setOpen(false);
    setActionsOpen(false);
  };
  const pageId = /^\/pages\/([^/]+)$/.exec(pathname)?.[1];
  const folderId = /^\/folders\/([^/]+)$/.exec(pathname)?.[1];
  const { data: path } = useQuery({
    ...trpc.tree.getAncestorPath.queryOptions({
      folder_id: folderId,
      page_id: pageId,
    }),
    enabled: Boolean(pageId || folderId),
  });
  const journal = pathname.startsWith("/journal");
  const label = journal
    ? "Journal"
    : pathname.startsWith("/explore") || pathname.startsWith("/graph")
      ? "Explore"
      : "Library";
  const { preferences, updatePreferences } = useAppPreferences();
  const date = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(pathname)?.[1];
  const detail = journal
    ? date
      ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : preferences.journalTimelineView === "entries"
        ? "Entries"
        : "Timeline"
    : path
        ?.map((item) =>
          item.id === pageId && currentTitle !== null
            ? currentTitle || "Untitled"
            : item.name || "Untitled",
        )
        .join(" / ") ||
      (label === "Explore" ? "Threads and connections" : currentTitle || "");
  const navigate = (url: string) => {
    router.push(url);
    closeMenus();
  };
  const journalActions = (
    <>
      {(["entries", "timeline"] as const).map((mode) => (
        <Button
          key={mode}
          variant={
            preferences.journalTimelineView === mode ? "selected" : "ghost"
          }
          aria-pressed={preferences.journalTimelineView === mode}
          onClick={() => {
            updatePreferences({ journalTimelineView: mode });
            navigate("/journal");
          }}
        >
          {mode === "entries" ? "Entries" : "Timeline"}
        </Button>
      ))}
      <Button
        variant="ghost"
        aria-expanded={browseDates}
        onClick={() => setBrowseDates((value) => !value)}
      >
        Browse dates / history
      </Button>
      {browseDates && (
        <Calendar
          mode="single"
          captionLayout="dropdown"
          defaultMonth={date ? new Date(`${date}T12:00:00`) : undefined}
          selected={date ? new Date(`${date}T12:00:00`) : undefined}
          onSelect={(value) => {
            if (value) navigate(`/journal/${localDate(value)}`);
          }}
        />
      )}
      <Button
        variant="ghost"
        onClick={() => navigate(`/journal/${localDate(new Date())}`)}
      >
        Today
      </Button>
    </>
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      <RouteDisclosure
        open={open}
        onOpenChange={setOpen}
        label={`${label} route menu`}
        title={detail || label}
        trigger={
          <Button
            variant="ghost"
            className="h-auto min-h-11 min-w-0 max-w-full justify-start justify-self-start px-0 text-left"
          >
            <span className="min-w-0">
              <span className="block font-semibold">{label}</span>
              <span className="block max-w-80 truncate font-normal text-muted-foreground text-xs">
                {detail}
              </span>
            </span>
            <ChevronDown />
          </Button>
        }
      >
        {journal ? (
          journalActions
        ) : label === "Explore" ? (
          <>
            <Link href="/explore" onClick={closeMenus}>
              Threads
            </Link>
            <Link href="/graph" onClick={closeMenus}>
              Graph
            </Link>
          </>
        ) : (
          path?.map((item) => (
            <Link
              key={item.node_id}
              onClick={closeMenus}
              href={
                item.node_type === "page"
                  ? `/pages/${item.id}`
                  : `/folders/${item.id}`
              }
            >
              {item.id === pageId && currentTitle !== null
                ? currentTitle || "Untitled"
                : item.name || "Untitled"}
            </Link>
          ))
        )}
      </RouteDisclosure>
      <div className="shrink-0">
        <RouteDisclosure
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          label="Route actions"
          title="Route actions"
          align="start"
          trigger={
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="size-5" />
            </Button>
          }
        >
          {journal && journalActions}
          {viewport === "desktop" && (
            <Button
              variant="ghost"
              onClick={() => {
                closeMenus();
                setOpenMobile(true);
              }}
            >
              Notebook navigation
            </Button>
          )}
          {children}
        </RouteDisclosure>
      </div>
    </div>
  );
}
