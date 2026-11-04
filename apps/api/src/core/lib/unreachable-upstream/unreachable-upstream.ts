import { SDKError } from "@akashnetwork/chain-sdk/web";
import axios from "axios";

/** Failures to open the connection at all, so the upstream never saw the request and retrying it is safe. */
const UNREACHABLE_UPSTREAM_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

/** Only HTTP and chain clients count, so console-api's own database refusing connections still reads as a console-api failure. */
export function isUnreachableUpstreamError(error: unknown): boolean {
  const causeChain = getCauseChain(error);

  return causeChain.some(isUpstreamClientError) && causeChain.some(hasUnreachableUpstreamCode);
}

function getCauseChain(error: unknown): Error[] {
  const causeChain: Error[] = [];

  for (let link = error; link instanceof Error && !causeChain.includes(link); link = link.cause) {
    causeChain.push(link);
  }

  return causeChain;
}

function isUpstreamClientError(error: Error): boolean {
  return axios.isAxiosError(error) || error instanceof SDKError;
}

function hasUnreachableUpstreamCode(error: Error): boolean {
  const { code } = error as { code?: unknown };

  return typeof code === "string" && UNREACHABLE_UPSTREAM_CODES.has(code);
}
