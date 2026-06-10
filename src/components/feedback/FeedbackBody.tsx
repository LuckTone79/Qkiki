"use client";

/**
 * Renders feedback text with inline images. Images are only rendered when they
 * point at our own attachment endpoint, so user-supplied markdown cannot embed
 * arbitrary remote resources. Everything else is rendered as plain text with
 * line breaks preserved (no raw HTML is ever injected).
 */
const IMAGE_PATTERN = /!\[([^\]]*)\]\((\/api\/feedback\/attachments\/[a-z0-9]+\/raw)\)/gi;

type Segment =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; url: string };

function parseSegments(body: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of body.matchAll(IMAGE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, index) });
    }
    segments.push({ type: "image", alt: match[1] || "image", url: match[2] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }

  return segments;
}

export function FeedbackBody({ body }: { body: string }) {
  const segments = parseSegments(body);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-stone-800">
      {segments.map((segment, index) => {
        if (segment.type === "image") {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={index}
              src={segment.url}
              alt={segment.alt}
              className="max-h-[480px] max-w-full rounded-md border border-stone-200"
            />
          );
        }

        if (!segment.value.trim()) {
          return null;
        }

        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {segment.value.trim()}
          </p>
        );
      })}
    </div>
  );
}
