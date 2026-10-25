import type {
  DocumentBlock,
  InlineContent,
  ReferenceProps,
  TableContent,
} from "./schema";

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "'": "&#39;", '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" })[
        char
      ] ?? char,
  );
const escapeMarkdown = (text: string) => text.replace(/[\\`*_[\]<>]/g, "\\$&");
function safeUrl(url: string) {
  const trimmed = url.trim();
  if (
    [...trimmed].some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    ) ||
    trimmed.startsWith("//")
  )
    return "";
  return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(trimmed) ? trimmed : "";
}
function reference(props: ReferenceProps, html: boolean) {
  const url = safeUrl(props.url);
  const label = props.label || props.url;
  return html
    ? url
      ? `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
      : escapeHtml(label)
    : url
      ? `[${escapeMarkdown(label)}](${url.replace(/[<>()]/g, (char) => encodeURIComponent(char))})`
      : escapeMarkdown(label);
}
function inline(content: InlineContent | undefined, html: boolean): string {
  if (!content) return "";
  if (typeof content === "string")
    return html
      ? escapeHtml(content).replace(/\n/g, "<br>")
      : escapeMarkdown(content);
  return content
    .map((item) => {
      if (typeof item === "string") return inline(item, html);
      if (item.type === "contentReference") return reference(item.props, html);
      if (item.type === "link") {
        const label = inline(item.content, html);
        const url = safeUrl(item.href);
        return !url
          ? label
          : html
            ? `<a href="${escapeHtml(url)}">${label}</a>`
            : `[${label}](${url.replace(/[<>()]/g, (char) => encodeURIComponent(char))})`;
      }
      const styles = item.styles ?? {};
      let result = inline(item.text, html);
      if (styles.code) {
        if (html) result = `<code>${escapeHtml(item.text)}</code>`;
        else {
          const fence = "`".repeat(
            Math.max(
              0,
              ...(item.text.match(/`+/g) ?? []).map((s) => s.length),
            ) + 1,
          );
          result = `${fence} ${item.text} ${fence}`;
        }
      }
      for (const [key, tag, mark] of [
        ["bold", "strong", "**"],
        ["italic", "em", "*"],
        ["strike", "s", "~~"],
        ["underline", "u", ""],
      ] as const) {
        if (styles[key])
          result = html
            ? `<${tag}>${result}</${tag}>`
            : `${mark}${result}${mark}`;
      }
      return result;
    })
    .join("");
}
function table(content: TableContent | undefined, html: boolean): string {
  const rows = content?.rows ?? [];
  const cells = rows.map((row) =>
    row.cells.map((cell) => {
      if (typeof cell === "object" && !Array.isArray(cell)) {
        const text = inline(cell.content, html);
        return html
          ? `<td colspan="${cell.props?.colspan ?? 1}" rowspan="${cell.props?.rowspan ?? 1}">${text}</td>`
          : text;
      }
      const text = inline(cell, html);
      return html ? `<td>${text}</td>` : text;
    }),
  );
  if (html)
    return `<table>${cells.map((row) => `<tr>${row.join("")}</tr>`).join("")}</table>`;
  if (!cells.length) return "";
  const width = Math.max(...cells.map((row) => row.length));
  const rendered = cells.map(
    (row) =>
      `| ${Array.from({ length: width }, (_, i) => (row[i] ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>")).join(" | ")} |`,
  );
  rendered.splice(1, 0, `| ${Array(width).fill("---").join(" | ")} |`);
  return rendered.join("\n");
}
function blockText(block: DocumentBlock, html: boolean): string {
  switch (block.type) {
    case "referenceCard":
    case "contentEmbed":
      return reference(block.props, html);
    case "table":
      return table(block.content, html);
    case "divider":
      return html ? "<hr>" : "---";
    case "codeBlock": {
      const text =
        typeof block.content === "string"
          ? block.content
          : (block.content ?? [])
              .map((item) => (typeof item === "string" ? item : item.text))
              .join("");
      if (html) return `<pre><code>${escapeHtml(text)}</code></pre>`;
      const fence = "`".repeat(
        Math.max(2, ...(text.match(/`+/g) ?? []).map((s) => s.length)) + 1,
      );
      return `${fence}${(block.props?.language ?? "").replace(/[^\w+-]/g, "")}\n${text}\n${fence}`;
    }
    case "image":
    case "video":
    case "audio":
    case "file": {
      const url = safeUrl(block.props?.url ?? "");
      const label = block.props?.caption || block.props?.name || block.type;
      if (!url) return html ? escapeHtml(label) : escapeMarkdown(label);
      if (html)
        return block.type === "image"
          ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(label)}">`
          : `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
      return `${block.type === "image" ? "!" : ""}[${escapeMarkdown(label)}](${url.replace(/[<>()]/g, (char) => encodeURIComponent(char))})`;
    }
    default:
      return inline(block.content, html);
  }
}
export function documentMarkdown(blocks: readonly DocumentBlock[]): string {
  return blocks
    .map((block) => {
      let text = blockText(block, false);
      if (block.type === "heading")
        text = `${"#".repeat(block.props?.level ?? 1)} ${text}`;
      if (block.type === "quote")
        text = text
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
      const marker =
        block.type === "numberedListItem"
          ? `${block.props?.start ?? 1}. `
          : block.type === "checkListItem"
            ? `- [${block.props?.checked ? "x" : " "}] `
            : block.type === "bulletListItem" || block.type === "toggleListItem"
              ? "- "
              : "";
      const children = block.children?.length
        ? documentMarkdown(block.children)
        : "";
      return (
        marker +
        text +
        (children
          ? `\n${children
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n")}`
          : "")
      );
    })
    .join("\n\n");
}
/** Lossy, safe interchange HTML, never the authoritative document representation. */
export function documentHtml(blocks: readonly DocumentBlock[]): string {
  const result: string[] = [];
  let list: "ul" | "ol" | undefined;
  const closeList = () => {
    if (list) result.push(`</${list}>`);
    list = undefined;
  };
  for (const block of blocks) {
    const text = blockText(block, true);
    const children = documentHtml(block.children ?? []);
    const listTag =
      block.type === "numberedListItem"
        ? "ol"
        : ["bulletListItem", "checkListItem", "toggleListItem"].includes(
              block.type,
            )
          ? "ul"
          : undefined;
    if (listTag) {
      if (list !== listTag) {
        closeList();
        list = listTag;
        const start =
          block.type === "numberedListItem" && block.props?.start !== undefined
            ? ` start="${block.props.start}"`
            : "";
        result.push(`<${list}${start}>`);
      }
      const checkbox =
        block.type === "checkListItem"
          ? `<input type="checkbox" disabled${block.props?.checked ? " checked" : ""}> `
          : "";
      result.push(`<li>${checkbox}${text}${children}</li>`);
    } else {
      closeList();
      const tag =
        block.type === "heading"
          ? `h${block.props?.level ?? 1}`
          : block.type === "quote"
            ? "blockquote"
            : "p";
      const own = ["table", "divider", "codeBlock", "image"].includes(
        block.type,
      )
        ? text
        : `<${tag}>${text}</${tag}>`;
      result.push(own + children);
    }
  }
  closeList();
  return result.join("\n");
}
