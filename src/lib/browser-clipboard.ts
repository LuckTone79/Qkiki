type ClipboardLike = {
  writeText?: (text: string) => Promise<void>;
};

type NavigatorLike = {
  clipboard?: ClipboardLike;
};

export type ClipboardEnvironment = {
  navigator?: NavigatorLike;
};

export type ClipboardCopyResult =
  | { copied: true; reason: "copied" }
  | { copied: false; reason: "unsupported" | "blocked"; error?: unknown };

function getRuntimeNavigator() {
  return typeof navigator === "undefined" ? undefined : navigator;
}

export async function copyTextToClipboard(
  text: string,
  environment: ClipboardEnvironment = {},
): Promise<ClipboardCopyResult> {
  const runtimeNavigator = environment.navigator ?? getRuntimeNavigator();
  const clipboard = runtimeNavigator?.clipboard;
  const writeText = clipboard?.writeText;

  if (typeof writeText !== "function") {
    return { copied: false, reason: "unsupported" };
  }

  try {
    await writeText.call(clipboard, text);
    return { copied: true, reason: "copied" };
  } catch (error) {
    return { copied: false, reason: "blocked", error };
  }
}
