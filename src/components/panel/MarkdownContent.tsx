"use client";

import ReactMarkdown from "react-markdown";
import type { ContentBlock } from "@/types/node-content";

/** Convert content blocks to a single markdown string for rendering */
function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return `${"#".repeat(block.level ?? 2)} ${block.text}`;
      case "paragraph":
        return block.text;
      case "note":
        return `> ${block.text}`;
      case "code":
        return `\`\`\`${block.language ?? ""}\n${block.text}\n\`\`\``;
      case "divider":
        return "---";
      case "checklist":
        return block.items.map((i) => `- [${i.checked ? "x" : " "}] ${i.text}`).join("\n");
      default:
        return "";
    }
  }).filter(Boolean).join("\n\n");
}

interface MarkdownContentProps {
  /** Either raw markdown string or content blocks */
  markdown?: string;
  blocks?: ContentBlock[];
  description?: string;
}

export function MarkdownContent({ markdown, blocks, description }: MarkdownContentProps) {
  // Build the markdown string
  let md = markdown ?? "";
  // Prefer blocks over description if blocks have real content
  if (!md && blocks && blocks.length > 0) md = blocksToMarkdown(blocks);
  if (!md && description) md = description;
  // If description is the same as first block's text, don't duplicate
  if (md === description && blocks && blocks.length > 0) {
    const blocksMd = blocksToMarkdown(blocks);
    if (blocksMd) md = blocksMd;
  }
  if (!md) return <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", fontStyle: "italic" }}>No content.</p>;

  return (
    <div className="markdown-content">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#22c55e", marginTop: 10, marginBottom: 4, borderBottom: "1px solid rgba(34,197,94,0.2)", paddingBottom: 3, textTransform: "uppercase", letterSpacing: "0.1em" }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 10, marginBottom: 4, borderLeft: "2px solid #3b82f6", paddingLeft: 6 }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 600, color: "#f59e0b", marginTop: 8, marginBottom: 2 }}>▸ {children}</h3>
          ),
          p: ({ children }) => (
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", lineHeight: 1.65, marginBottom: 5 }}>{children}</div>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 14, marginBottom: 6 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 14, marginBottom: 6 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8", lineHeight: 1.6, marginBottom: 2 }}>{children}</li>
          ),
          code: ({ inline, children, ...props }: React.ComponentPropsWithRef<"code"> & { inline?: boolean }) =>
            inline ? (
              <code style={{ fontFamily: "monospace", fontSize: 10, color: "#a5b4fc", backgroundColor: "rgba(99,102,241,0.15)", padding: "1px 4px", borderRadius: 3 }}>{children}</code>
            ) : (
              <pre style={{ backgroundColor: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 3, padding: "6px 8px", overflowX: "auto", marginBottom: 6 }}>
                <code style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-all" }} {...props}>{children}</code>
              </pre>
            ),
          blockquote: ({ children }) => (
            <blockquote style={{ borderLeft: "2px solid #475569", paddingLeft: 8, margin: "4px 0", color: "#64748b", fontStyle: "italic" }}>{children}</blockquote>
          ),
          hr: () => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "8px 0" }} />,
          strong: ({ children }) => (
            <strong style={{ color: "#e2e8f0", fontWeight: 700 }}>{children}</strong>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", textDecoration: "underline" }}>{children}</a>
          ),
          input: ({ checked }) => (
            <input type="checkbox" checked={checked} readOnly style={{ marginRight: 5, accentColor: "#22c55e" }} />
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}
