/** Some browsers resolve no time zone at all, so each caller decides what an unknown one means. */
export function detectBrowserTimezone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
}

export function getBrowserTimezoneOrUtc(): string {
  return detectBrowserTimezone() ?? "UTC";
}
