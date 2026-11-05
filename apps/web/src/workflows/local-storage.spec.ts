import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { prepareLocalWorkflowStorage } from "./local-storage";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "journl-workflow-storage-"));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { force: true, recursive: true });
});

test("legacy Workflow state survives a build-directory cleanup", () => {
  const root = fixture();
  mkdirSync(join(root, ".next/workflow-data"), { recursive: true });
  writeFileSync(
    join(root, ".next/workflow-data/run.json"),
    '{"preserve":"history"}',
  );
  prepareLocalWorkflowStorage(root, ".workflow-data");
  rmSync(join(root, ".next"), { force: true, recursive: true });
  expect(readFileSync(join(root, ".workflow-data/run.json"), "utf8")).toBe(
    '{"preserve":"history"}',
  );
  prepareLocalWorkflowStorage(root, ".workflow-data");
});

test("conflicting data directories abort before either copy changes", () => {
  const root = fixture();
  mkdirSync(join(root, ".next/workflow-data"), { recursive: true });
  mkdirSync(join(root, ".workflow-data"));
  writeFileSync(join(root, ".next/workflow-data/old.json"), "old");
  writeFileSync(join(root, ".workflow-data/new.json"), "new");
  expect(() => prepareLocalWorkflowStorage(root, ".workflow-data")).toThrow(
    "both",
  );
  expect(readFileSync(join(root, ".next/workflow-data/old.json"), "utf8")).toBe(
    "old",
  );
  expect(readFileSync(join(root, ".workflow-data/new.json"), "utf8")).toBe(
    "new",
  );
});

test("Workflow data cannot be placed inside generated output", () => {
  const root = fixture();
  for (const target of [".next", ".next/workflow-data", ".next/custom"])
    expect(() => prepareLocalWorkflowStorage(root, target)).toThrow(
      "outside .next",
    );
  prepareLocalWorkflowStorage(root, ".workflow-data");
  expect(existsSync(join(root, ".next"))).toBe(false);
});

test("a storage symlink cannot point into generated output", () => {
  const root = fixture();
  mkdirSync(join(root, ".next/custom"), { recursive: true });
  writeFileSync(join(root, ".next/custom/state.json"), "preserve");
  symlinkSync(
    join(root, ".next/custom"),
    join(root, ".workflow-data"),
    "junction",
  );
  expect(() => prepareLocalWorkflowStorage(root, ".workflow-data")).toThrow(
    "outside .next",
  );
  expect(readFileSync(join(root, ".next/custom/state.json"), "utf8")).toBe(
    "preserve",
  );
});

test("a missing storage directory under a symlink cannot point into generated output", () => {
  const root = fixture();
  mkdirSync(join(root, ".next/custom"), { recursive: true });
  symlinkSync(join(root, ".next/custom"), join(root, "linked"), "junction");
  expect(() => prepareLocalWorkflowStorage(root, "linked/new-data")).toThrow(
    "outside .next",
  );
});

test("a symlink outside generated output remains usable", () => {
  const root = fixture();
  mkdirSync(join(root, "persistent"));
  symlinkSync(
    join(root, "persistent"),
    join(root, ".workflow-data"),
    "junction",
  );
  prepareLocalWorkflowStorage(root, ".workflow-data");
});

test("a legacy storage symlink aborts before its target changes", () => {
  const root = fixture();
  mkdirSync(join(root, ".next"));
  mkdirSync(join(root, "persistent"));
  writeFileSync(join(root, "persistent/run.json"), "preserve");
  symlinkSync(
    join(root, "persistent"),
    join(root, ".next/workflow-data"),
    "junction",
  );
  expect(() => prepareLocalWorkflowStorage(root, ".workflow-data")).toThrow(
    "symlink",
  );
  expect(readFileSync(join(root, "persistent/run.json"), "utf8")).toBe(
    "preserve",
  );
});
