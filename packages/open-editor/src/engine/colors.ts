const palette = new Set([
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);
export const editorColor = (value: unknown, background = false) =>
  typeof value === "string" && palette.has(value)
    ? `var(--open-editor-${background ? "background" : "text"}-${value})`
    : typeof value === "string" &&
        value !== "default" &&
        /^[a-zA-Z0-9#(),.% -]+$/.test(value)
      ? value
      : background
        ? "transparent"
        : "inherit";
