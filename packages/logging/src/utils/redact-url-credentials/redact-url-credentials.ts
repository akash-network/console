const CREDENTIAL_PARAM_NAME = /token|secret|password|signature|api[-_]?key/i;

const REDACTED_URL_CREDENTIAL = "REDACTED";

/** Some links carry their credential in the query string, such as one-click unsubscribe links, so its value never reaches a log or a span. */
export function redactUrlCredentials(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) return url;

  const fragmentStart = url.indexOf("#", queryStart);
  const queryEnd = fragmentStart === -1 ? url.length : fragmentStart;
  const query = url
    .slice(queryStart + 1, queryEnd)
    .split("&")
    .map(redactCredentialParam)
    .join("&");

  return `${url.slice(0, queryStart + 1)}${query}${url.slice(queryEnd)}`;
}

function redactCredentialParam(param: string): string {
  const valueStart = param.indexOf("=");
  if (valueStart === -1) return param;

  const name = param.slice(0, valueStart);
  return CREDENTIAL_PARAM_NAME.test(name) ? `${name}=${REDACTED_URL_CREDENTIAL}` : param;
}
