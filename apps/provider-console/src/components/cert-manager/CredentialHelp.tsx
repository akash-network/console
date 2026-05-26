"use client";
import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@akashnetwork/ui/components";
import { HelpCircle } from "iconoir-react";

interface CredentialHelpProps {
  ariaLabel: string;
  children: React.ReactNode;
}

export const CredentialHelp: React.FC<CredentialHelpProps> = ({ ariaLabel, children }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label={ariaLabel} className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center">
        <HelpCircle className="h-4 w-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-96 text-xs">
      {children}
    </PopoverContent>
  </Popover>
);

export const CloudflareTokenHelp: React.FC = () => (
  <div className="space-y-2">
    <p className="text-sm font-semibold">Generate a Cloudflare API token</p>
    <ol className="list-inside list-decimal space-y-1">
      <li>
        Go to <strong>Cloudflare dashboard → My Profile → API Tokens</strong>.
      </li>
      <li>
        Click <strong>Create Token</strong>, then under &quot;API token templates&quot; choose <strong>&quot;Edit zone DNS&quot;</strong> →{" "}
        <strong>Use template</strong>.
      </li>
      <li>
        Leave the pre-filled permissions as-is. The summary should read exactly:
        <ul className="ml-4 mt-1 list-disc">
          <li>
            <code>Zone</code> · <code>Read</code>
          </li>
          <li>
            <code>DNS</code> · <code>Edit</code>
          </li>
        </ul>
        Don&apos;t pick &quot;DNS Settings&quot; or &quot;DNS Firewall&quot; — those are different APIs.
      </li>
      <li>
        Under <strong>Zone Resources</strong>, set <code>Include</code> · <code>Specific zone</code> · the apex domain that hosts your provider (e.g.{" "}
        <code>example.com</code>).
      </li>
      <li>Leave Client IP Address Filtering empty unless you have a fixed egress IP.</li>
      <li>
        <strong>Continue → Create Token</strong>, then copy the token. Cloudflare only shows it once — paste it into the field on the left immediately.
      </li>
    </ol>
  </div>
);

export const CloudDnsServiceAccountHelp: React.FC = () => (
  <div className="space-y-2">
    <p className="text-sm font-semibold">Generate a GCP service account key</p>
    <ol className="list-inside list-decimal space-y-1">
      <li>
        Go to <strong>GCP Console → IAM &amp; Admin → Service Accounts</strong>, in the project that hosts your DNS zone.
      </li>
      <li>
        Click <strong>Create service account</strong> (or pick an existing one). Give it a name like
        <code> cert-manager-dns01</code>.
      </li>
      <li>
        Grant role <strong>DNS Administrator</strong> (<code>roles/dns.admin</code>) on the project. cert-manager needs permission to create and delete TXT
        records on your managed zones.
      </li>
      <li>
        Open the service account → <strong>Keys</strong> tab → <strong>Add Key → Create new key</strong> → <strong>JSON</strong> → <strong>Create</strong>. A{" "}
        <code>.json</code> key file downloads.
      </li>
      <li>
        In the form, click <strong>Upload .json</strong> and pick the file (or paste the JSON contents directly into the textarea).
      </li>
      <li>
        Set <strong>GCP project ID</strong> to the same project as the service account (the <code>project_id</code> field inside the JSON key).
      </li>
    </ol>
  </div>
);
