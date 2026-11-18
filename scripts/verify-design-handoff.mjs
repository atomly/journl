import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

// This verifies reference integrity and inventory coverage, not production acceptance.
const argument = process.argv[2];
if (!argument) {
  process.stderr.write(
    "Usage: pnpm design:verify /path/to/approved-handoff-v2\n",
  );
  process.exit(2);
}
const application = resolve(argument, "application");
const index = JSON.parse(
  await readFile(resolve(application, "screen-state-index.json"), "utf8"),
);
assert.equal(index.designedStates, 438);
assert.equal(index.images, 1830);
const coverage = await readFile(
  new URL(
    "../docs/design-handoff/implementation-coverage.csv",
    import.meta.url,
  ),
  "utf8",
);
const [header, ...lines] = coverage.trimEnd().split(/\r?\n/);
assert.equal(
  header,
  "state_id,family,baseline,historical_browser_status,canonical_images,variants,behavior_exercise,visual_acceptance",
);
const rows = new Map();
for (const line of lines) {
  const fields = line.split(",");
  assert.equal(
    fields.length,
    8,
    "Coverage fields cannot contain commas or newlines",
  );
  assert(!rows.has(fields[0]), `Duplicate coverage state: ${fields[0]}`);
  rows.set(fields[0], fields);
}
assert.equal(rows.size, 438);
const states = new Map();
const hashes = new Map();
for (const record of index.records) {
  const variants = states.get(record.stateId) ?? [];
  variants.push(record);
  states.set(record.stateId, variants);
  const image = resolve(application, record.image);
  assert(
    image.startsWith(resolve(application, "screenshots") + sep),
    "Canonical image must be inside screenshots",
  );
  if (!hashes.has(image)) {
    const bytes = await readFile(image);
    assert.equal(
      bytes.length,
      record.bytes,
      `Image length mismatch: ${record.image}`,
    );
    assert.equal(bytes.readUInt32BE(16), record.imageDimensions.width);
    assert.equal(bytes.readUInt32BE(20), record.imageDimensions.height);
    hashes.set(image, createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(
    hashes.get(image),
    record.sha256,
    `Image hash mismatch: ${record.image}`,
  );
}
assert.equal(hashes.size, 1830);
assert.equal(states.size, rows.size);
let pending = 0;
for (const [id, variants] of states) {
  const row = rows.get(id);
  assert(row, `Coverage missing state: ${id}`);
  const first = variants[0];
  assert.equal(row[1], first.family);
  assert.equal(row[2], String(first.baseline));
  assert.equal(row[3], first.currentBrowserStatus);
  assert.equal(
    Number(row[4]),
    new Set(variants.map((record) => record.image)).size,
  );
  assert.equal(Number(row[5]), variants.length);
  if (row[6]) await readFile(new URL(`../${row[6]}`, import.meta.url));
  assert(["pending", "matched", "blocked", "not-applicable"].includes(row[7]));
  if (row[7] === "pending") pending++;
}
process.stdout.write(
  `Reference integrity verified: ${hashes.size} canonical PNGs, ${states.size} state IDs.\n`,
);
process.stdout.write(
  `Production visual acceptance pending: ${pending} state IDs. Behavior exercise paths do not establish visual parity.\n`,
);
