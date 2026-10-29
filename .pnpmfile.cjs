// The global virtual store needs type peers beside React-dependent packages.
// Compatibility for pnpm 12.8.2, before addMissingPeerTypes:
// https://github.com/orgs/pnpm/discussions/15689
module.exports = {
  hooks: {
    readPackage(pkg) {
      for (const name of ["react", "react-dom"]) {
        const types = `@types/${name}`;
        if (
          !pkg.peerDependencies?.[name] ||
          pkg.peerDependencies[types] ||
          pkg.dependencies?.[types]
        )
          continue;
        pkg.peerDependencies[types] = "*";
        pkg.peerDependenciesMeta = {
          ...pkg.peerDependenciesMeta,
          [types]: { optional: true },
        };
      }
      return pkg;
    },
  },
};
