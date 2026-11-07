const PERSONAL_DATA_PROPERTIES: ReadonlySet<string> = new Set([
  "userid",
  "createdby",
  "updatedby",
  "deletedby",
  "invitedby",
  "initiatedby",
  "firstname",
  "lastname",
  "fullname",
  "givenname",
  "familyname",
  "invitername",
  "legalname",
  "company",
  "companyname",
  "mobile",
  "ip",
  "ipaddress",
  "useragent",
  "line1",
  "line2",
  "addressline1",
  "addressline2",
  "postalcode",
  "zipcode",
  "taxid",
  "card",
  "brand",
  "last4",
  "fingerprint",
  "expmonth",
  "expyear"
]);

const PERSONAL_DATA_PREFIXES = ["contact", "billing", "webhook"];
const PERSONAL_DATA_SUFFIXES = ["email", "emails", "emailaddress", "phone", "phonenumber", "username"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedPropertyOf(property: string): string {
  return property.replace(/[_-]/g, "").toLowerCase();
}

export function isPersonalDataProperty(property: string): boolean {
  const name = normalizedPropertyOf(property);

  return (
    PERSONAL_DATA_PROPERTIES.has(name) ||
    PERSONAL_DATA_PREFIXES.some(prefix => name.startsWith(prefix)) ||
    PERSONAL_DATA_SUFFIXES.some(suffix => name.endsWith(suffix))
  );
}

/** Drops personal and contact properties at any depth, whatever the route declares, since a published schema can still carry a teammate's details. */
export function withoutPersonalData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutPersonalData);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([property]) => !isPersonalDataProperty(property))
      .map(([property, entry]) => [property, withoutPersonalData(entry)])
  );
}
