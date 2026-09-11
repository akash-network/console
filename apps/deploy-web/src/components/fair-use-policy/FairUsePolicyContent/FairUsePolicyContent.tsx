"use client";
import type { ComponentType } from "react";
import { Ban, Coins, Copyright, CreditCard, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const FAIR_USE_POLICY_TITLE = "Review and accept our Fair Use Policy before you deploy on Akash Console";
export const FAIR_USE_POLICY_ACCEPT_LABEL = "I agree to the Fair Use Policy";

const PROHIBITED_WORKLOADS: { label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { label: "Crypto miners", Icon: Coins },
  { label: "Phishing", Icon: ShieldAlert },
  { label: "Card fraud & testing", Icon: CreditCard },
  { label: "Spam", Icon: Mail },
  { label: "Pirated content", Icon: Copyright },
  { label: "Anything illegal", Icon: Ban }
];

export function FairUsePolicyContent() {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-destructive">Hosting or distributing any of the following will permanently close your account.</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {PROHIBITED_WORKLOADS.map(({ label, Icon }) => (
          <li key={label} className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <Icon className="h-4 w-4 shrink-0 text-destructive" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">
        Akash Console is for building and deploying software. We do not allow the kind of resource abuse that degrades the network for everyone else. The full
        list of prohibited uses is in section 7 of the{" "}
        <Link href={UrlService.prohibitedUse()} target="_blank" className="underline">
          Terms of Service
        </Link>
        .
      </p>
    </div>
  );
}
