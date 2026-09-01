type AutoReloadState = { autoReloadEnabled: boolean; autoReloadPausedAt: Date | null };

/** A wallet paused after repeated declines stays opted in but must be treated as off everywhere a charge or a metric depends on it. */
export function isAutoReloadActive<T extends AutoReloadState>(setting: T | null | undefined): setting is T {
  return !!setting?.autoReloadEnabled && !setting.autoReloadPausedAt;
}
