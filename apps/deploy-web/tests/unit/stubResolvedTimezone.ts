import { vi } from "vitest";

export function stubResolvedTimezone(timeZone: string | undefined) {
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;

  return vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function resolveWithStubbedTimezone(this: Intl.DateTimeFormat) {
    return { ...resolvedOptions.call(this), timeZone: timeZone as string };
  });
}
