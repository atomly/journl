import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("./editor.css", import.meta.url), "utf8");
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels.reduce(
    (sum, channel, i) => sum + channel * ([0.2126, 0.7152, 0.0722][i] ?? 0),
    0,
  );
}
for (const [theme, background, foreground] of [
  [":root", "#fefefe", "#3f3f3f"],
  [".dark", "#171717", "#cfcfcf"],
]) {
  test(`${theme} named text colors remain legible on every supported highlight`, () => {
    const body = css.split(`${theme} {`)[1]?.split("}")[0] ?? "";
    const colors = (kind: string) =>
      [
        ...body.matchAll(
          new RegExp(`--openeditor-${kind}-([a-z]+): (#[a-f0-9]{6})`, "g"),
        ),
      ].map((match) => ({ hex: match[2] ?? "", name: match[1] }));
    const text = [
      ...colors("text"),
      { hex: foreground ?? "", name: "default" },
    ];
    const highlights = [
      ...colors("background"),
      { hex: background ?? "", name: "default" },
    ];
    expect(text).toHaveLength(10);
    expect(highlights).toHaveLength(10);
    for (const fg of text)
      for (const bg of highlights) {
        const low = Math.min(luminance(fg.hex), luminance(bg.hex));
        const high = Math.max(luminance(fg.hex), luminance(bg.hex));
        expect(
          (high + 0.05) / (low + 0.05),
          `${fg.name} on ${bg.name}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
  });
}
