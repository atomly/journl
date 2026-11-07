// biome-ignore-all lint/suspicious/noArrayIndexKey: Streamed text parts and stateless code lines retain positional identity as content grows.
"use client";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@acme/ui/code-block";
import { useDrawer } from "@acme/ui/drawer";
import { useHighlightedCode } from "@acme/ui/use-highlighted-code";
import Link from "next/link";
import { isValidElement, memo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { stripOpenAICitationTokens } from "~/ai/utils/openai-utils";
import { copyTextToClipboard } from "~/lib/clipboard";

function MarkdownCode({
  value,
  language,
}: {
  value: string;
  language: string;
}) {
  const lines = useHighlightedCode(value, language);
  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockTitle>{language || "Text"}</CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={value} copyText={copyTextToClipboard} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent className="max-h-96">
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
    </CodeBlock>
  );
}
function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) {
  const { closeDrawer } = useDrawer();
  if (!href) return <span>{children}</span>;
  const local =
    (href.startsWith("/") && !href.startsWith("//")) ||
    (typeof window !== "undefined" &&
      href.startsWith(`${window.location.origin}/`));
  return local ? (
    <Link href={href} onClick={() => closeDrawer()}>
      {children}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
function MarkdownPre({ children }: { children?: ReactNode }) {
  const code = isValidElement<{ children?: ReactNode; className?: string }>(
    children,
  )
    ? children
    : undefined;
  const value = String(code?.props.children ?? "").replace(/\n$/, "");
  const language = code?.props.className?.match(/language-(\S+)/)?.[1] ?? "";
  return <MarkdownCode value={value} language={language} />;
}
const markdownComponents: Components = { a: MarkdownLink, pre: MarkdownPre };
const markdownPlugins = [remarkGfm];
export const ChatMarkdown = memo(function ChatMarkdown({
  text,
}: {
  text: string;
}) {
  return (
    <div className="chat-markdown min-w-0">
      <ReactMarkdown
        remarkPlugins={markdownPlugins}
        components={markdownComponents}
      >
        {stripOpenAICitationTokens(text)}
      </ReactMarkdown>
    </div>
  );
});
