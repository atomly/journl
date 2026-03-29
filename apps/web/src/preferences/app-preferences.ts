export const APP_PREFERENCES_COOKIE_NAME = "journl:preferences";
export const APP_PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const APP_SIDEBAR_WIDTH_REM_DEFAULT = 14;
export const APP_SIDEBAR_WIDTH_REM_MIN = 14;
export const APP_SIDEBAR_WIDTH_REM_MAX = 50;

export const CHAT_SIDEBAR_WIDTH_REM_DEFAULT = 20;
export const CHAT_SIDEBAR_WIDTH_REM_MIN = 20;
export const CHAT_SIDEBAR_WIDTH_REM_MAX = 50;

export type JournalTimelineView = "timeline" | "entries";

export type AppPreferences = {
  journalTimelineView: JournalTimelineView;
  appSidebarOpen: boolean;
  appSidebarWidthRem: number;
  chatSidebarOpen: boolean;
  chatSidebarWidthRem: number;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  appSidebarOpen: true,
  appSidebarWidthRem: APP_SIDEBAR_WIDTH_REM_DEFAULT,
  chatSidebarOpen: true,
  chatSidebarWidthRem: CHAT_SIDEBAR_WIDTH_REM_DEFAULT,
  journalTimelineView: "entries",
};

const JOURNAL_TIMELINE_VIEWS = new Set<JournalTimelineView>([
  "timeline",
  "entries",
]);

function normalizeSidebarWidth(
  value: number | string | null | undefined,
  min: number,
  max: number,
  fallback: number,
) {
  const resolved =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(resolved)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, resolved));
}

export function normalizeAppPreferences(
  input?: Partial<AppPreferences> | null,
): AppPreferences {
  const journalTimelineView = input?.journalTimelineView;
  const appSidebarOpen = input?.appSidebarOpen;
  const chatSidebarOpen = input?.chatSidebarOpen;

  return {
    appSidebarOpen:
      typeof appSidebarOpen === "boolean"
        ? appSidebarOpen
        : DEFAULT_APP_PREFERENCES.appSidebarOpen,
    appSidebarWidthRem: normalizeSidebarWidth(
      input?.appSidebarWidthRem,
      APP_SIDEBAR_WIDTH_REM_MIN,
      APP_SIDEBAR_WIDTH_REM_MAX,
      DEFAULT_APP_PREFERENCES.appSidebarWidthRem,
    ),
    chatSidebarOpen:
      typeof chatSidebarOpen === "boolean"
        ? chatSidebarOpen
        : DEFAULT_APP_PREFERENCES.chatSidebarOpen,
    chatSidebarWidthRem: normalizeSidebarWidth(
      input?.chatSidebarWidthRem,
      CHAT_SIDEBAR_WIDTH_REM_MIN,
      CHAT_SIDEBAR_WIDTH_REM_MAX,
      DEFAULT_APP_PREFERENCES.chatSidebarWidthRem,
    ),
    journalTimelineView:
      journalTimelineView && JOURNAL_TIMELINE_VIEWS.has(journalTimelineView)
        ? journalTimelineView
        : DEFAULT_APP_PREFERENCES.journalTimelineView,
  };
}

export function parseAppPreferences(value?: string | null): AppPreferences {
  if (!value) {
    return DEFAULT_APP_PREFERENCES;
  }

  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as Partial<AppPreferences>;
    return normalizeAppPreferences(parsed);
  } catch {
    return DEFAULT_APP_PREFERENCES;
  }
}

export function serializeAppPreferences(preferences: AppPreferences) {
  return JSON.stringify(preferences);
}
