import { useId } from "react";
import type { ProviderName } from "@/lib/ai/types";

/* Stroke line-icon set (1.8px) — replaces the emoji navigation icons. */

type IconProps = {
  className?: string;
};

function strokeProps(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: className ?? "h-5 w-5",
  };
}

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export function FileIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M13 3L5 13h6l-1 8 8-10h-6z" />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M4 19.5V6a2 2 0 0 1 2-2h13v14H6.5a2.5 2.5 0 0 0 0 5H19" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function ChatIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3.2A8 8 0 1 1 21 12z" />
    </svg>
  );
}

export function MoreIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CompareIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M7 4v16M12 4v16M17 4v16" />
    </svg>
  );
}

/**
 * Yapp brand mark — a node-network glyph: one central node branching into
 * three, standing for a single prompt fanning out to multiple AI models.
 * Uses currentColor so it inverts cleanly on any brand tile.
 */
export function BrandMark({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className ?? "h-5 w-5"}
    >
      <path d="M12 12.6 6.9 5.9M12 12.6 17.2 5.9M12 12.6 9.6 19.8" />
      <circle cx="6.9" cy="5.9" r="1.75" fill="none" />
      <circle cx="17.2" cy="5.9" r="1.75" fill="none" />
      <circle cx="9.6" cy="19.8" r="1.75" fill="none" />
      <circle cx="12" cy="12.6" r="2.2" fill="currentColor" />
    </svg>
  );
}

/** @deprecated Use {@link BrandMark}. Kept as an alias during the rebrand. */
export const SparkMarkIcon = BrandMark;

/* Official provider logo marks (monochrome glyph paths, fill-based).
   Rendered on app-icon style tiles: OpenAI/Grok white-on-black,
   Claude orange-on-cream, Gemini gradient-on-white. */

type ProviderGlyphDefinition = {
  viewBox: string;
  path: string;
};

const PROVIDER_GLYPHS: Record<ProviderName, ProviderGlyphDefinition> = {
  openai: {
    viewBox: "0 0 24 24",
    path:
      "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z",
  },
  anthropic: {
    viewBox: "0 0 100 100",
    path:
      "m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z",
  },
  google: {
    viewBox: "0 0 24 24",
    path:
      "M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12",
  },
  xai: {
    viewBox: "60 60 392 390",
    path:
      "M213.235 306.019l178.976-180.002v.169l51.695-51.763c-.924 1.32-1.86 2.605-2.785 3.89-39.281 54.164-58.46 80.649-43.07 146.922l-.09-.101c10.61 45.11-.744 95.137-37.398 131.836-46.216 46.306-120.167 56.611-181.063 14.928l42.462-19.675c38.863 15.278 81.392 8.57 111.947-22.03 30.566-30.6 37.432-75.159 22.065-112.252-2.92-7.025-11.67-8.795-17.792-4.263l-124.947 92.341zm-25.786 22.437-.033.034L68.094 435.217c7.565-10.429 16.957-20.294 26.327-30.149 26.428-27.803 52.653-55.359 36.654-94.302-21.422-52.112-8.952-113.177 30.724-152.898 41.243-41.254 101.98-51.661 152.706-30.758 11.23 4.172 21.016 10.114 28.638 15.639l-42.359 19.584c-39.44-16.563-84.629-5.299-112.207 22.313-37.298 37.308-44.84 102.003-1.128 143.81z",
  },
};

export function ProviderGlyph({
  provider,
  className,
}: {
  provider: ProviderName;
  className?: string;
}) {
  const gradientId = useId();
  const isGemini = provider === "google";
  const glyph = PROVIDER_GLYPHS[provider];
  return (
    <svg
      viewBox={glyph.viewBox}
      aria-hidden
      className={className ?? "h-5 w-5"}
      fill={isGemini ? `url(#${gradientId})` : "currentColor"}
    >
      {isGemini ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4285F4" />
            <stop offset="1" stopColor="#9B72CB" />
          </linearGradient>
        </defs>
      ) : null}
      <path d={glyph.path} />
    </svg>
  );
}

/* App-icon style tile behind each provider glyph. */
const PROVIDER_TILE_CLASS: Record<ProviderName, string> = {
  openai: "bg-black text-white",
  anthropic: "bg-[#F8F3EE] text-[#D97757] border border-[#D97757]/20",
  google: "bg-white text-[#4285F4] border border-stone-200",
  xai: "bg-black text-white",
};

export function ProviderLogoTile({
  provider,
  className,
  glyphClassName,
}: {
  provider: ProviderName;
  className?: string;
  glyphClassName?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center ${PROVIDER_TILE_CLASS[provider]} ${
        className ?? "h-10 w-10 rounded-xl"
      }`}
    >
      <ProviderGlyph provider={provider} className={glyphClassName ?? "h-5 w-5"} />
    </span>
  );
}
