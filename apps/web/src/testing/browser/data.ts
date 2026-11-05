export const browserFixture = {
  cluster: "00000000-0000-4000-8000-000000000354",
  email: "browser-owner@example.invalid",
  longJournalDate: "2000-01-01",
  otherEmail: "browser-other@example.invalid",
  otherOwner: "browser-other",
  owner: "browser-owner",
  paginationEmail: "journal-pagination@example.invalid",
  paginationOwner: "journal-pagination",
  password: "disposable-browser-password-354",
};
export const fixtureId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
