/** Validators often enter a bare domain, which a link would otherwise resolve as a path on this site. */
export function toValidatorWebsiteUrl(website: string | undefined): string | undefined {
  const trimmedWebsite = website?.trim();
  if (!trimmedWebsite) return undefined;

  const prefixedWebsite = `http://${trimmedWebsite}`;
  const websiteUrl = !/^https?:\/\//i.test(trimmedWebsite) && isValidHttpUrl(prefixedWebsite) ? prefixedWebsite : trimmedWebsite;

  return isValidHttpUrl(websiteUrl) ? websiteUrl : undefined;
}

function isValidHttpUrl(str: string): boolean {
  let url;

  try {
    url = new URL(str);
  } catch {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}
