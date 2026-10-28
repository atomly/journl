import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Both installation modes use these exact sources. No vendored editor copy.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.argv[2] ?? "https://journl-snowy.vercel.app/r/";
const packages = ["document", "references", "ui", "better-editor"];
const itemName = (name) =>
  name === "better-editor" ? "better-editor" : `better-editor-${name}`;
const manifests = Object.fromEntries(
  await Promise.all(
    packages.map(async (name) => [
      name,
      JSON.parse(
        await readFile(`${root}/packages/${name}/package.json`, "utf8"),
      ),
    ]),
  ),
);
async function sources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? sources(`${directory}/${entry.name}`)
        : [`${directory}/${entry.name}`],
    ),
  );
  return files
    .flat()
    .filter(
      (path) =>
        /\.(ts|tsx|css)$/.test(path) && !/\.(spec|test|bench)\./.test(path),
    )
    .sort();
}
// Unique basenames keep shadcn import rewriting unambiguous across namespaces.
function installedPath(name, relative) {
  return posix.join(
    name,
    posix.dirname(relative),
    `${name}-${relative.split("/").join("-")}`,
  );
}
function rewrite(content, owner, sourceRelative) {
  const directory = posix.dirname(installedPath(owner, sourceRelative));
  return content.replace(
    /(["'])(@acme\/[\w-]+[^"']*|\.\.?\/[^"']+)\1/g,
    (match, quote, specifier) => {
      let target;
      if (specifier.startsWith("@acme/")) {
        const [, name, subpath = ""] = specifier.match(/^@acme\/([\w-]+)(.*)$/);
        const manifest = manifests[name];
        if (!manifest)
          throw new Error(`Registry imports an unbundled package: ${match}`);
        const entry = manifest.exports[subpath ? `.${subpath}` : "."];
        if (typeof entry !== "string")
          throw new Error(`Missing export: ${match}`);
        target = installedPath(
          name,
          entry.replace(/^\.\/src\//, "").replace(/\.tsx?$/, ""),
        );
      } else {
        target = installedPath(
          owner,
          posix.join(posix.dirname(sourceRelative), specifier),
        );
      }
      const relative = posix.relative(directory, target);
      return `${quote}${relative.startsWith(".") ? relative : `./${relative}`}${quote}`;
    },
  );
}
const items = [];
for (const name of packages) {
  const manifest = manifests[name];
  const files = await Promise.all(
    (await sources(`${root}/packages/${name}/src`)).map(async (source) => {
      const relative = source.split(`/packages/${name}/src/`)[1];
      return {
        content: rewrite(await readFile(source, "utf8"), name, relative),
        path: `registry/better-editor/${installedPath(name, relative)}`,
        target: `@components/better-editor/${installedPath(name, relative)}`,
        type: "registry:file",
      };
    }),
  );
  const dependencies = new Set();
  const registryDependencies = [];
  for (const [dependency, version] of Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  })) {
    if (dependency.startsWith("@acme/")) {
      const sibling = dependency.slice(6);
      if (!packages.includes(sibling))
        throw new Error(`Unbundled dependency ${dependency}`);
      // Resolve dependency URLs against the same deployment.
      registryDependencies.push(
        new URL(`${itemName(sibling)}.json`, baseUrl).href,
      );
    } else dependencies.add(`${dependency}@${version}`);
  }
  items.push({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    dependencies: [...dependencies].sort(),
    files,
    name: itemName(name),
    registryDependencies,
    title: name === "better-editor" ? "BetterEditor" : `BetterEditor ${name}`,
    type: "registry:block",
  });
}
const output = `${root}/apps/web/public/r`;
await mkdir(output, { recursive: true });
for (const item of items)
  await writeFile(
    `${output}/${item.name}.json`,
    `${JSON.stringify(item, null, 2)}\n`,
  );
await writeFile(
  `${output}/registry.json`,
  `${JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema/registry.json",
      homepage: "https://github.com/atomly/journl",
      items,
      name: "journl",
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Built ${items.length} editor registry items from workspace sources.\n`,
);
