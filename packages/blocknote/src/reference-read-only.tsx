import { ReferenceBadge } from "./reference-badge";
import { ReferenceCardView } from "./reference-card";
import { ReferenceEmbedView } from "./reference-embed";
import { type ReactNode } from "react";
import { type ReferenceEmbedBlock } from "./reference-context";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

function renderInline(value: unknown, key: number): ReactNode {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((child, index) => renderInline(child, index));
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "text") {
    const styles = (record.styles ?? {}) as Record<string, unknown>;
    let text: ReactNode = String(record.text ?? "");
    if (styles.bold) text = <strong>{text}</strong>;
    if (styles.italic) text = <em>{text}</em>;
    if (styles.underline) text = <u>{text}</u>;
    if (styles.strike) text = <s>{text}</s>;
    if (styles.code) text = <code>{text}</code>;
    return <span key={key}>{text}</span>;
  }
  if (record.type === "link")
    return (
      <a key={key} href={safeHref(String(record.href ?? "#"))}>
        {renderInline(record.content, key + 1)}
      </a>
    );
  if (record.type === "contentReference")
    return (
      <ReferenceBadge
        key={key}
        props={(record.props ?? {}) as Record<string, unknown>}
        contentRef={() => {}}
        readOnly
      />
    );
  return null;
}

export function ReadOnlyBlocks({
  blocks,
  depth,
  ancestorKeys,
}: {
  blocks: ReferenceEmbedBlock[];
  depth: number;
  ancestorKeys: Set<string>;
}) {
  return (
    <div className="content-embed-body">
      {blocks.map((block, index) => {
        const key = block.id ?? `${block.type}-${index}`;
        const content = renderInline(block.content, index);
        let element: ReactNode;
        if (block.type === "heading") {
          const level = Number(block.props?.level ?? 2);
          element =
            level === 1 ? (
              <h1>{content}</h1>
            ) : level === 3 ? (
              <h3>{content}</h3>
            ) : (
              <h2>{content}</h2>
            );
        } else if (
          ["bulletListItem", "numberedListItem", "checkListItem"].includes(
            block.type,
          )
        ) {
          const marker =
            block.type === "checkListItem" ? (
              <input
                type="checkbox"
                checked={Boolean(block.props?.checked)}
                disabled
                aria-label="Embedded checklist item"
              />
            ) : block.type === "numberedListItem" ? (
              `${Number(block.props?.start ?? index + 1)}.`
            ) : (
              "•"
            );
          element = (
            <div className="content-embed-list-item">
              <span>{marker}</span>
              <div>{content}</div>
            </div>
          );
        } else if (block.type === "codeBlock")
          element = (
            <pre>
              <code>{content}</code>
            </pre>
          );
        else if (block.type === "quote")
          element = <blockquote>{content}</blockquote>;
        else if (block.type === "divider") element = <hr />;
        else if (block.type === "contentEmbed")
          element = (
            <ReferenceEmbedView
              props={block.props ?? {}}
              depth={depth + 1}
              ancestorKeys={ancestorKeys}
            />
          );
        else if (block.type === "referenceCard")
          element = <ReferenceCardView block={{ props: block.props ?? {} }} />;
        else if (block.type === "table") {
          const table = block.content as
            | { rows?: Array<{ cells?: unknown[] }> }
            | undefined;
          element = (
            <div className="content-embed-table">
              <table>
                <tbody>
                  {table?.rows?.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`}>
                      {row.cells?.map((cell, cellIndex) => (
                        <td key={`cell-${cellIndex}`}>
                          {renderInline(
                            cell &&
                              typeof cell === "object" &&
                              !Array.isArray(cell)
                              ? (cell as Record<string, unknown>).content
                              : cell,
                            cellIndex,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        } else element = <p>{content}</p>;
        return (
          <div
            key={key}
            style={{
              paddingInlineStart: `${Math.min(block.depth ?? 0, 6) * 1.25}rem`,
            }}
          >
            {element}
          </div>
        );
      })}
    </div>
  );
}
