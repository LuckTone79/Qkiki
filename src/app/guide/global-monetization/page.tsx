import type { Metadata } from "next";
import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { APP_VERSION } from "@/lib/version";

const guidePath = path.join(
  process.cwd(),
  "docs",
  "GLOBAL_MONETIZATION_GUIDE_2026-06-12.md",
);

export const metadata: Metadata = {
  title: "Global Monetization Guide | Qkiki",
  description:
    "A mobile-friendly Korean guidebook for global subscription pricing, payment providers, Korean business registration, and payout setup.",
};

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][] };

function isTableSeparator(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isListLine(line: string) {
  return /^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim());
}

function startsNewBlock(line: string) {
  const trimmed = line.trim();
  return (
    trimmed === "" ||
    /^#{1,4}\s+/.test(trimmed) ||
    trimmed.startsWith(">") ||
    isListLine(trimmed) ||
    isTableLine(trimmed)
  );
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      index += 1;
      continue;
    }

    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", lines: quoteLines });
      continue;
    }

    if (isListLine(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (index < lines.length && isListLine(lines[index])) {
        const item = lines[index].trim().replace(/^([-*]|\d+\.)\s+/, "");
        items.push(item);
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    if (isTableLine(line)) {
      const rows: string[][] = [];
      while (index < lines.length && isTableLine(lines[index])) {
        const row = splitTableRow(lines[index]);
        if (!isTableSeparator(row)) {
          rows.push(row);
        }
        index += 1;
      }
      if (rows.length > 0) {
        blocks.push({ type: "table", rows });
      }
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !startsNewBlock(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInline(text: string) {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.92em] text-stone-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold text-stone-950">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a
            key={`${match.index}-link`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-stone-950 underline decoration-stone-300 underline-offset-4"
          >
            {link[1]}
          </a>,
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function blockClassForHeading(level: number) {
  if (level === 1) {
    return "mb-5 mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl";
  }
  if (level === 2) {
    return "mt-12 border-t border-stone-200 pt-8 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl";
  }
  if (level === 3) {
    return "mt-8 text-xl font-semibold tracking-tight text-stone-950 sm:text-2xl";
  }
  return "mt-6 text-lg font-semibold text-stone-900";
}

function HeadingBlock({ level, text }: { level: number; text: string }) {
  const className = blockClassForHeading(level);

  if (level === 1) {
    return <h1 className={className}>{renderInline(text)}</h1>;
  }
  if (level === 2) {
    return <h2 className={className}>{renderInline(text)}</h2>;
  }
  if (level === 3) {
    return <h3 className={className}>{renderInline(text)}</h3>;
  }
  return <h4 className={className}>{renderInline(text)}</h4>;
}

function MarkdownContent({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return <HeadingBlock key={index} level={block.level} text={block.text} />;
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={index}
              className="border-l-4 border-stone-300 bg-stone-50 px-4 py-3 text-sm leading-7 text-stone-700 sm:text-base"
            >
              {block.lines.map((line, quoteIndex) => (
                <p key={quoteIndex}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={`space-y-2 pl-5 text-base leading-8 text-stone-700 sm:text-[17px] ${
                block.ordered ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "table") {
          const [head, ...body] = block.rows;
          return (
            <div
              key={index}
              className="-mx-4 overflow-x-auto border-y border-stone-200 sm:mx-0 sm:rounded-md sm:border"
            >
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-stone-50 text-stone-950">
                  <tr>
                    {head.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-stone-200 px-4 py-3 font-semibold"
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-stone-100 last:border-b-0">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="min-w-36 px-4 py-3 text-stone-700">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={index} className="text-base leading-8 text-stone-700 sm:text-[17px]">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

export default async function GlobalMonetizationGuidePage() {
  const markdown = await readFile(guidePath, "utf8");
  const blocks = parseMarkdown(markdown);

  return (
    <main className="min-h-screen bg-white text-stone-950">
      <header className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <Link href="/" className="font-medium text-stone-900 hover:underline">
              Qkiki
            </Link>
            <span>/</span>
            <Link href="/guide" className="font-medium text-stone-900 hover:underline">
              Guide
            </Link>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
              Mobile guidebook
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
              글로벌 수익화 준비 가이드북
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              구독료, 결제 플러그인, 사업자등록, 해외 매출 정산까지 한 번에 확인할 수
              있도록 모바일 화면에 맞춰 렌더링한 문서입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/files/global-monetization-guide-2026-06-12"
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
            >
              원문 Markdown 보기
            </a>
            <a
              href="#sources"
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 transition hover:bg-stone-100"
            >
              공식 자료 링크
            </a>
          </div>
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <MarkdownContent blocks={blocks} />
        <footer
          id="sources"
          className="mt-14 border-t border-stone-200 pt-6 text-sm leading-6 text-stone-500"
        >
          <p>Source document: docs/GLOBAL_MONETIZATION_GUIDE_2026-06-12.md</p>
          <p>Version: {APP_VERSION}</p>
        </footer>
      </article>
    </main>
  );
}
