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

export function SparkMarkIcon({ className }: IconProps) {
  return (
    <svg {...strokeProps(className)}>
      <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
    </svg>
  );
}

/* Official provider logo marks (monochrome glyph paths, fill-based).
   Rendered on app-icon style tiles: OpenAI/xAI white-on-black,
   Anthropic dark-on-cream, Gemini gradient-on-white. */

const PROVIDER_GLYPHS: Record<ProviderName, string> = {
  openai:
    "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.073zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z",
  anthropic:
    "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5527h3.7442L10.5363 3.541Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z",
  google:
    "M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12",
  xai:
    "m3.005 8.858 8.783 12.544h3.904L6.908 8.858zM6.905 15.825 3 21.402h3.907l1.951-2.788zM16.585 2l-6.75 9.64 1.953 2.79L20.492 2zM17.292 7.965v13.437h3.2V3.395z",
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
  return (
    <svg
      viewBox="0 0 24 24"
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
      <path d={PROVIDER_GLYPHS[provider]} />
    </svg>
  );
}

/* App-icon style tile behind each provider glyph. */
const PROVIDER_TILE_CLASS: Record<ProviderName, string> = {
  openai: "bg-black text-white",
  anthropic: "bg-[#EEECE2] text-[#1F1E1D]",
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
