const FALLBACK_LOCALE = "en-US";

/** Some browsers report a POSIX locale such as `en-US@posix` or `en_US.UTF-8`, which every `Intl` API rejects with a RangeError. */
export function getBrowserLocale(): string {
  try {
    const bcp47Candidate = navigator.language.split(/[@.]/)[0].replace(/_/g, "-");
    return Intl.getCanonicalLocales(bcp47Candidate)[0];
  } catch {
    return FALLBACK_LOCALE;
  }
}
