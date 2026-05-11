"use client";

import { MessageCodeBlock } from "./message-code-block";
import { useMemo } from "react";

interface MessageMarkdownProps {
  content: string;
}

interface ParsedBlock {
  type: "paragraph" | "code" | "heading" | "list" | "blockquote" | "hr";
  content: string;
  language?: string;
  level?: number;
  items?: string[];
}

function parseMarkdown(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.match(/^```(\w*)/)) {
      const language = line.match(/^```(\w*)/)?.[1] || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), language });
      i++;
      continue;
    }

    if (line.match(/^#{1,6}\s/)) {
      const match = line.match(/^(#{1,6})\s(.*)/);
      if (match) {
        blocks.push({
          type: "heading",
          content: match[2],
          level: match[1].length,
        });
      }
      i++;
      continue;
    }

    if (line.match(/^>\s/)) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].match(/^>\s/)) {
        quoteLines.push(lines[i].replace(/^>\s/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    if (line.match(/^[-*]\s/) || line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].match(/^[-*]\s/) || lines[i].match(/^\d+\.\s/))) {
        items.push(lines[i].replace(/^[-*]\s/, "").replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "list", content: "", items });
      continue;
    }

    if (line.trim() === "---") {
      blocks.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].match(/^```|^#{1,6}\s|^>\s|^[-*]\s|^\d+\.\s|^---/)) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return blocks;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)|(\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      parts.push(<strong key={key++} className="text-white font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++} className="italic">{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <code key={key++} className="px-1.5 py-0.5 rounded bg-paracosm-gray text-paracosm-green text-sm font-mono">
          {match[6]}
        </code>
      );
    } else if (match[7]) {
      parts.push(
        <a key={key++} href={match[9]} className="text-paracosm-cyan hover:underline" target="_blank" rel="noopener noreferrer">
          {match[8]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function MessageMarkdown({ content }: MessageMarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="text-sm text-gray-200 leading-relaxed">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph":
            return <p key={index} className="mb-2">{renderInline(block.content)}</p>;
          case "code":
            return <MessageCodeBlock key={index} language={block.language || "text"} code={block.content} />;
          case "heading": {
            const HeadingTag = `h${block.level || 1}` as keyof JSX.IntrinsicElements;
            const sizes: Record<number, string> = {
              1: "text-xl font-bold text-white",
              2: "text-lg font-bold text-white",
              3: "text-base font-semibold text-white",
              4: "text-sm font-semibold text-white",
              5: "text-sm font-medium text-white",
              6: "text-xs font-medium text-gray-300",
            };
            return <HeadingTag key={index} className={`${sizes[block.level || 1]} mb-2 mt-4`}>{renderInline(block.content)}</HeadingTag>;
          }
          case "list":
            return (
              <ul key={index} className="list-disc list-inside mb-2 space-y-1">
                {block.items?.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case "blockquote":
            return (
              <blockquote key={index} className="border-l-2 border-paracosm-green/40 pl-4 py-1 my-2 text-gray-400 italic">
                {renderInline(block.content)}
              </blockquote>
            );
          case "hr":
            return <hr key={index} className="border-paracosm-gray-light/20 my-4" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
