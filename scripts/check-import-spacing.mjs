import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "@babel/parser";

// Parse top-level statements so multiline imports, comments, and import-like
// strings cannot confuse this rule. Preserve comments attached to the next item.
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => /\.[cm]?[jt]sx?$/.test(file));
let failures = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const source = parse(text, {
    plugins: [
      ...(/\.[cm]?tsx?$/.test(file) ? ["typescript"] : []),
      ...(/\.[jt]sx$/.test(file) ? ["jsx"] : []),
    ],
    sourceType: "unambiguous",
  }).program;
  const edits = [];
  for (let i = 0; i < source.body.length - 1; i++) {
    const statement = source.body[i];
    const next = source.body[i + 1];
    if (
      statement.type !== "ImportDeclaration" &&
      statement.type !== "TSImportEqualsDeclaration"
    )
      continue;
    if (
      next.type === "ImportDeclaration" ||
      next.type === "TSImportEqualsDeclaration"
    )
      continue;
    const trivia = text.slice(statement.end, next.start);
    // A trailing line comment belongs to the import; a later comment belongs
    // to the code. Require the gap before that attached comment, not after it.
    const gap =
      /^(?:[^\S\r\n]*(?:\/\/[^\r\n]*|\/\*[^\r\n]*?\*\/))?([^\S\r\n]*(?:\r?\n[\t ]*)*)/.exec(
        trivia,
      );
    const whitespace = gap?.[1] ?? "";
    if ((whitespace.match(/\n/g) ?? []).length === 2) continue;
    const end = statement.end + (gap?.[0].length ?? 0);
    edits.push({ end, start: end - whitespace.length });
    if (!process.argv.includes("--fix"))
      console.error(
        `${file}:${statement.loc.end.line}: imports/newline-after-import: expected one empty line`,
      );
  }
  if (process.argv.includes("--fix")) {
    let result = text;
    const newline = text.includes("\r\n") ? "\r\n" : "\n";
    for (const edit of edits.reverse())
      result =
        result.slice(0, edit.start) +
        newline.repeat(2) +
        result.slice(edit.end);
    if (edits.length) writeFileSync(file, result);
  } else failures += edits.length;
}
if (failures) process.exitCode = 1;
