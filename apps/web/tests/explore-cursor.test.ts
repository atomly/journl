import { expect, test } from "vitest";
import {
  decodeExploreCursor,
  encodeExploreCursor,
} from "../src/explore/cursor";

const data = {
  after: "00000000-0000-4000-8000-000000000002",
  date: "2026-10-08T00:00:00Z",
  owner: "owner",
  scope: "clusters:project",
  snapshot: "00000000-0000-4000-8000-000000000001",
};
test("cursor round trip preserves the snapshot and complete sort tuple", () => {
  expect(
    decodeExploreCursor(encodeExploreCursor(data), data.owner, data.scope),
  ).toEqual(data);
});
test.each([
  ["other", data.scope],
  [data.owner, "sources:project"],
])("cursors cannot cross owner or query scopes", (owner, scope) => {
  expect(() =>
    decodeExploreCursor(encodeExploreCursor(data), owner, scope),
  ).toThrow();
});
test.each(["garbage", Buffer.from("{}").toString("base64url")])(
  "invalid cursors are rejected",
  (cursor) => {
    expect(() => decodeExploreCursor(cursor, data.owner, data.scope)).toThrow();
  },
);
