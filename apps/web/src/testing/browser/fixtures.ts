import { test as base, expect } from "@playwright/test";
import { browserFixture } from "./data";

export const test = base.extend<{ otherOwner: boolean }>({
  otherOwner: [false, { option: true }],
  page: async ({ page, otherOwner }, use) => {
    const response = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email: otherOwner ? browserFixture.otherEmail : browserFixture.email,
        password: browserFixture.password,
      },
      headers: { Origin: "http://127.0.0.1:3100" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await use(page);
  },
});
export { expect };
