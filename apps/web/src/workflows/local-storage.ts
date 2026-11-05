import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  renameSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

// Resolve existing ancestors too: a new directory can sit under a symlink.
function physicalPath(path: string): string {
  const missing: string[] = [];
  let current = path;
  while (!lstatSync(current, { throwIfNoEntry: false })) {
    missing.unshift(basename(current));
    const parent = dirname(current);
    if (parent === current)
      throw new Error("Cannot resolve Workflow storage location.");
    current = parent;
  }
  return resolve(realpathSync(current), ...missing);
}

/** Preserve local run state before Next removes generated build output. */
export function prepareLocalWorkflowStorage(
  projectDir: string,
  dataDir: string,
) {
  const target = resolve(projectDir, dataDir);
  const withinBuild = relative(
    physicalPath(resolve(projectDir, ".next")),
    physicalPath(target),
  );
  if (
    !isAbsolute(withinBuild) &&
    withinBuild !== ".." &&
    !withinBuild.startsWith(`..${sep}`)
  ) {
    throw new Error(
      "WORKFLOW_LOCAL_DATA_DIR must be outside .next because Next deletes build output.",
    );
  }
  const legacy = resolve(projectDir, ".next/workflow-data");
  const legacyInfo = lstatSync(legacy, { throwIfNoEntry: false });
  if (!legacyInfo) return;
  if (legacyInfo.isSymbolicLink()) {
    throw new Error(
      "Legacy Workflow storage is a symlink. Preserve its target outside .next before building.",
    );
  }
  if (existsSync(target)) {
    throw new Error(
      "Workflow state exists in both .next/workflow-data and the configured data directory. Preserve and reconcile both before building.",
    );
  }
  mkdirSync(dirname(target), { recursive: true });
  renameSync(legacy, target);
}
