import { isWithinDomain } from "@src/workload-abuse/lib/email-domain/email-domain";

/** Services that forward every address on a domain to another inbox without hosting a mailbox, which is how a catch-all on a throwaway domain is set up for free. */
const MAIL_FORWARDING_MX_DOMAINS = ["mx.cloudflare.net", "improvmx.com", "forwardemail.net"];

export function isForwardingOnly(mxHosts: string[]): boolean {
  return mxHosts.length > 0 && mxHosts.every(host => MAIL_FORWARDING_MX_DOMAINS.some(forwarder => isWithinDomain(host, forwarder)));
}
