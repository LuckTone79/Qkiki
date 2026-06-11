type StorageLike = Pick<Storage, "getItem" | "setItem">;

function resolveBrowserStorage(
  storageOverride?: StorageLike | null,
) {
  if (storageOverride !== undefined) {
    return storageOverride;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readBrowserStorageValue(
  key: string,
  options?: { storage?: StorageLike | null },
) {
  const storage = resolveBrowserStorage(options?.storage);
  if (!storage?.getItem) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeBrowserStorageValue(
  key: string,
  value: string,
  options?: { storage?: StorageLike | null },
) {
  const storage = resolveBrowserStorage(options?.storage);
  if (!storage?.setItem) {
    return false;
  }

  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
