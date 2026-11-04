"use client";
import type { ComponentType } from "react";
import { Ban, Copyright, CreditCard, MailX, OctagonAlert, Pickaxe, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const FAIR_USE_POLICY_TITLE = "Review and accept our Fair Use Policy before you deploy on Akash Console";
export const FAIR_USE_POLICY_ACCEPT_LABEL = "I agree to the Fair Use Policy";

const PROHIBITED_WORKLOADS: { label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { label: "Crypto miners", Icon: Pickaxe },
  { label: "Phishing", Icon: ShieldAlert },
  { label: "Card fraud & testing", Icon: CreditCard },
  { label: "Spam", Icon: MailX },
  { label: "Pirated content", Icon: Copyright },
  { label: "Anything illegal", Icon: Ban }
];

export function FairUsePolicyContent() {
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Akash Console is for building and deploying software. We do not allow the kind of resource abuse that degrades the network for everyone else.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border">
        <p className="flex items-start gap-2.5 border-b bg-muted px-3.5 py-3 text-sm font-medium">
          <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          Hosting or distributing any of the following will permanently close your account.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2">
          {PROHIBITED_WORKLOADS.map(({ label, Icon }) => (
            <li key={label} className="flex items-center gap-2.5 border-t px-3.5 py-3 text-sm first:border-t-0 sm:odd:border-r sm:[&:nth-child(2)]:border-t-0">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3.5 text-xs text-muted-foreground">
        The full list of prohibited uses is in section 7 of the{" "}
        <Link href={UrlService.prohibitedUse()} target="_blank" className="text-foreground underline underline-offset-[3px]">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
