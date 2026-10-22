import { test as base, expect } from "@playwright/test";
import { browserFixture } from "./data";

export const test = base.extend<{
  otherOwner: boolean;
  journalPagination: boolean;
}>({
  journalPagination: [false, { option: true }],
  otherOwner: [false, { option: true }],
  page: async ({ page, otherOwner, journalPagination }, use) => {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email: journalPagination
          ? browserFixture.paginationEmail
          : otherOwner
            ? browserFixture.otherEmail
            : browserFixture.email,
        password: browserFixture.password,
      },
      headers: { Origin: "http://127.0.0.1:3100" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await use(page);
  },
});
export { expect };
