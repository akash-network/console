const CREDENTIAL_PARAM_NAME = /token|secret|password|signature|api[-_]?key/i;

const QUERY_PARAM = /([?&])([^=&#]+)=([^&#]*)/g;

const REDACTED_URL_CREDENTIAL = "REDACTED";

/** Some links carry their credential in the query string, such as one-click unsubscribe links, so its value never reaches a log or a span. */
export function redactUrlCredentials(url: string): string {
  return url.replace(QUERY_PARAM, (param, separator: string, name: string) =>
    CREDENTIAL_PARAM_NAME.test(name) ? `${separator}${name}=${REDACTED_URL_CREDENTIAL}` : param
  );
}
