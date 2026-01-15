export const APP_PREFERENCES_COOKIE_NAME = "journl:preferences";
export const APP_PREFERENCES_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type JournalTimelineView = "timeline" | "entries";

export type AppPreferences = {
  journalTimelineView: JournalTimelineView;
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  journalTimelineView: "entries",
};

const JOURNAL_TIMELINE_VIEWS = new Set<JournalTimelineView>([
  "timeline",
  "entries",
]);

export function normalizeAppPreferences(
  input?: Partial<AppPreferences> | null,
): AppPreferences {
  const journalTimelineView = input?.journalTimelineView;

  return {
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
