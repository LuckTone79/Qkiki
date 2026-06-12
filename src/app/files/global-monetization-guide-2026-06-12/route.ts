import { readFile } from "node:fs/promises";
import path from "node:path";

const guidePath = path.join(
  process.cwd(),
  "docs",
  "GLOBAL_MONETIZATION_GUIDE_2026-06-12.md",
);

export async function GET() {
  const markdown = await readFile(guidePath, "utf8");

  return new Response(markdown, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Disposition":
        'inline; filename="GLOBAL_MONETIZATION_GUIDE_2026-06-12.md"',
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
