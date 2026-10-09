import { beforeEach, expect, test, vi } from "vitest";

const mock = vi.hoisted(() => ({ start: vi.fn(), update: vi.fn() }));
vi.mock("@acme/db/client", () => ({ db: { update: mock.update } }));
vi.mock("workflow/api", () => ({ start: mock.start }));
vi.mock("../src/workflows/explore-refresh", () => ({
  runExploreRefresh: vi.fn(),
}));

import { dispatchExploreRefresh } from "../src/explore/dispatch";

beforeEach(() => {
  mock.update.mockReset();
  mock.start.mockReset();
});
test("a transient dispatch database failure cannot reject a committed document save", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  mock.update.mockImplementation(() => {
    throw new Error("Temporary connection failure");
  });
  try {
    await expect(dispatchExploreRefresh("owner")).resolves.toBeUndefined();
    expect(mock.start).not.toHaveBeenCalled();
  } finally {
    log.mockRestore();
  }
});
test("enqueue failure resets the claimed durable request for recovery", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const claim = {
    returning: vi.fn(async () => [{ revision: 7, user_id: "owner" }]),
    set: vi.fn(() => claim),
    where: vi.fn(() => claim),
  };
  mock.update.mockReturnValue(claim);
  mock.start.mockRejectedValue(new Error("Queue unavailable"));
  try {
    await expect(dispatchExploreRefresh("owner")).resolves.toBeUndefined();
    expect(mock.update).toHaveBeenCalledTimes(2);
    expect(claim.set).toHaveBeenLastCalledWith({ dispatched_at: null });
  } finally {
    log.mockRestore();
  }
});
