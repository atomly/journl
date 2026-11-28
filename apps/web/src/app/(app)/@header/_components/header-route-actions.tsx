"use client";

import { Button, buttonVariants } from "@acme/ui/button";
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
import { ArrowLeft, CalendarDays, ChevronDown, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAppPreferences } from "~/components/preferences/app-preferences-provider";
import { useIsMobile, useShellReady } from "~/components/ui/use-shell-viewport";
import { useJournlAgent } from "~/hooks/use-journl-agent";
import { useTRPC } from "~/trpc/react";

function RouteDisclosure({
  open,
  onOpenChange,
  label,
  title,
  trigger,
  children,
  suppressed = false,
  journal = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  label: string;
  title: string;
  trigger: React.ReactElement;
  children: React.ReactNode;
  /** A menu with nothing to choose from never opens; the trigger stays an identity control. */
  suppressed?: boolean;
  journal?: boolean;
}) {
  const mobile = useIsMobile();
  const ready = useShellReady();
  const handleOpenChange = (value: boolean) => {
    if (suppressed) return;
    onOpenChange(value);
  };
  if (mobile)
    return (
      <Dialog open={suppressed ? false : open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={trigger} aria-label={label} disabled={!ready} />
        <DialogContent
          data-shell-menu
          data-journal-route-menu={journal || undefined}
          className="flex max-h-[65dvh] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden p-0"
        >
          <Surface
            material="glass"
            data-route-menu-heading
            className="flex min-h-[70px] shrink-0 items-center rounded-none border-x-0 border-t-0 p-4 pr-16"
          >
            <DialogHeader className="text-left">
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
          </Surface>
          <div className="journl-route-menu flex min-h-0 flex-col gap-1 overflow-auto p-4">
            {children}
          </div>
        </DialogContent>
      </Dialog>
    );
  return (
    <Popover open={suppressed ? false : open} onOpenChange={handleOpenChange}>
      <PopoverTrigger render={trigger} aria-label={label} disabled={!ready} />
      <PopoverContent
        align="start"
        data-shell-route-popover
        data-journal-route-menu={journal || undefined}
        className="max-h-[min(65dvh,var(--available-height,65dvh))] gap-0 overflow-hidden rounded-[20px] p-0"
      >
        <Surface
          material="glass"
          data-route-menu-heading
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
            data-route-menu-close
            onClick={() => onOpenChange(false)}
          >
            <XIcon />
          </Button>
        </Surface>
        <div className="journl-route-menu flex min-h-0 flex-col gap-1 overflow-auto p-4 [&>button]:min-h-11">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function HeaderRouteActions({ actions }: { actions?: React.ReactNode }) {
  const pathname = usePathname();
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
  const [dateOpen, setDateOpen] = useState(false);
  const [wideJournal, setWideJournal] = useState(false);
  const headerContent = useRef<HTMLDivElement>(null);
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);
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
  useLayoutEffect(() => {
    const content = headerContent.current;
    if (!journal || !content) return;
    const updateWidth = () => {
      const wide = !mobile && content.clientWidth >= 580;
      setWideJournal(wide);
      if (wide) setOpen(false);
      else setDateOpen(false);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(content);
    return () => observer.disconnect();
  }, [journal, mobile]);
  const inlineJournal = journal && !mobile && wideJournal;
  const library = pathname === "/library";
  const explore =
    pathname.startsWith("/explore") || pathname.startsWith("/graph");
  const account = pathname.startsWith("/account/");
  const subscription = pathname === "/subscription";
  const label =
    account || subscription
      ? "Account & plan"
      : journal
        ? "Journal"
        : library
          ? "All pages"
          : explore
            ? "Explore"
            : "Library";
  const { preferences, updatePreferences } = useAppPreferences();
  const date = /^\/journal\/(\d{4}-\d{2}-\d{2})$/.exec(pathname)?.[1];
  const detail = subscription
    ? "Subscription"
    : account
      ? pathname === "/account/security"
        ? "Security"
        : "Settings"
      : journal
        ? date
          ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : preferences.journalTimelineView === "entries"
            ? "Entries"
            : "Timeline"
        : library
          ? "Browse pages and folders"
          : explore
            ? "Threads and connections"
            : path
                ?.map((item) =>
                  item.id === pageId && currentTitle !== null
                    ? currentTitle || "Untitled"
                    : item.name || "Untitled",
                )
                .join(" / ") ||
              currentTitle ||
              "";
  const navigate = (url: string) => {
    router.push(url);
    closeMenu();
    setDateOpen(false);
  };
  // Notebook identity routes repeat the breadcrumb across the trigger and
  // the menu; the header shows the section instead, and a path with only the
  // current node has nothing to choose from, so its menu never opens.
  const identityRoute = Boolean(pageId || folderId);
  const identityMenuSuppressed = identityRoute && (path?.length ?? 2) <= 1;
  const journalModes = (
    <fieldset className="journal-route-modes">
      <legend className="sr-only">Journal view</legend>
      {(["entries", "timeline"] as const).map((mode) => (
        <Button
          key={mode}
          size="sm"
          variant="ghost"
          aria-pressed={preferences.journalTimelineView === mode}
          onClick={() => {
            updatePreferences({ journalTimelineView: mode });
            navigate("/journal");
          }}
        >
          {mode === "entries" ? "Entries" : "Timeline"}
        </Button>
      ))}
    </fieldset>
  );
  const selectedDate = date ? new Date(`${date}T12:00:00`) : undefined;
  const journalCalendar = (
    <Calendar
      key={date}
      className="bg-transparent"
      classNames={{ month: "gap-2" }}
      mode="single"
      captionLayout="dropdown"
      defaultMonth={selectedDate}
      selected={selectedDate}
      onSelect={(value) => {
        if (value) navigate(`/journal/${localDate(value)}`);
      }}
    />
  );
  const todayAction = (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => navigate(`/journal/${localDate(new Date())}`)}
    >
      Today
    </Button>
  );
  const journalActions = (
    <>
      {journalModes}
      <div className="journal-route-dates">
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={browseDates}
          onClick={() => setBrowseDates((value) => !value)}
        >
          <CalendarDays aria-hidden="true" />
          Browse dates / history
          <ChevronDown aria-hidden="true" />
        </Button>
        {todayAction}
      </div>
      {browseDates && journalCalendar}
    </>
  );
  return (
    <div ref={headerContent} className="flex min-w-0 flex-1 items-center gap-2">
      {inlineJournal || library || explore || account || subscription ? (
        <div className="min-w-0">
          <span className="block truncate font-semibold">{label}</span>
          <span className="block truncate text-muted-foreground text-xs">
            {detail}
          </span>
        </div>
      ) : (
        <RouteDisclosure
          open={open}
          onOpenChange={setOpen}
          label={identityMenuSuppressed ? label : `${label} route menu`}
          title={identityRoute || journal ? label : detail || label}
          journal={journal}
          suppressed={identityMenuSuppressed}
          trigger={
            <Button
              variant="ghost"
              className="h-auto min-h-11 min-w-0 max-w-full shrink justify-start justify-self-start px-0 text-left"
            >
              <span className="min-w-0">
                <span
                  className={
                    pageId
                      ? "block truncate font-normal text-[13px]"
                      : "block font-semibold"
                  }
                >
                  {pageId ? (
                    <>
                      {path && path.length > 1 && (
                        <span className="hidden text-muted-foreground min-[701px]:inline">
                          {path
                            .slice(0, -1)
                            .map((item) => item.name || "Untitled")
                            .join(" / ")}
                          {" / "}
                        </span>
                      )}
                      <span className="font-medium">
                        {currentTitle === null
                          ? path?.at(-1)?.name || "Page"
                          : currentTitle || "Untitled"}
                      </span>
                    </>
                  ) : (
                    label
                  )}
                </span>
                <span
                  className={
                    pageId
                      ? "sr-only"
                      : "block max-w-80 truncate font-normal text-muted-foreground text-xs"
                  }
                >
                  {detail}
                </span>
              </span>
              {!identityMenuSuppressed && <ChevronDown />}
            </Button>
          }
        >
          {journal
            ? journalActions
            : path?.map((item) => (
                <Link
                  key={item.node_id}
                  onClick={closeMenu}
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
              ))}
        </RouteDisclosure>
      )}
      <div
        data-slot="header-actions"
        className="ml-auto flex shrink-0 items-center gap-0 min-[701px]:gap-2"
      >
        {date && (
          <Link
            href="/journal"
            className={buttonVariants({ size: "icon", variant: "ghost" })}
            data-journal-back
            aria-label="Back to Journal"
            title="Back to Journal"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
        )}
        {inlineJournal && (
          <div className="journal-header-controls flex items-center gap-2">
            {journalModes}
            <RouteDisclosure
              open={dateOpen}
              onOpenChange={setDateOpen}
              label="Browse journal dates"
              title="Journal dates"
              journal
              trigger={
                <Button
                  size="sm"
                  variant="outline"
                  title={selectedDate ? detail : undefined}
                >
                  <CalendarDays aria-hidden="true" />
                  {selectedDate?.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  }) ?? "Browse dates"}
                  <ChevronDown aria-hidden="true" />
                </Button>
              }
            >
              {journalCalendar}
              <div className="journal-route-dates self-end">{todayAction}</div>
            </RouteDisclosure>
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}
