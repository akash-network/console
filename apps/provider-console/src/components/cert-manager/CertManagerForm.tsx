"use client";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Alert,
  AlertDescription,
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Textarea
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeClosed, Upload } from "iconoir-react";
import { z } from "zod";

import type { CertManagerPayload, DnsProvider } from "@src/types/certManager";
import { readFileAsBase64 } from "@src/utils/files";
import { CloudDnsServiceAccountHelp, CloudflareTokenHelp, CredentialHelp } from "./CredentialHelp";

interface CertManagerFormProps {
  onSubmit: (payload: CertManagerPayload) => void | Promise<void>;
  acmeEmailMode: "required" | "optional";
  defaultValues?: Partial<{
    acme_email: string;
    dns_provider: DnsProvider;
  }>;
  acmeEmailHelpText?: string;
  rootError?: string;
  fieldErrors?: Record<string, string>;
  isSubmitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

interface CertManagerFormValues {
  acme_email: string;
  dns_provider: DnsProvider | "";
  cloudflare: { api_token: string };
  clouddns: { project: string; service_account_json: string };
}

const decodeBase64 = (value: string): string => {
  if (typeof atob === "function") return atob(value);
  return Buffer.from(value, "base64").toString("utf-8");
};

const isValidServiceAccountJson = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{")) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return false;
  try {
    JSON.parse(decodeBase64(trimmed.replace(/\s+/g, "")));
    return true;
  } catch {
    return false;
  }
};

const buildSchema = (acmeEmailMode: "required" | "optional") => {
  const acmeEmail =
    acmeEmailMode === "required"
      ? z.string().min(1, "Email is required").email("Invalid email address")
      : z.string().email("Invalid email address").optional().or(z.literal(""));

  return z
    .object({
      acme_email: acmeEmail,
      dns_provider: z.enum(["cloudflare", "clouddns"], { errorMap: () => ({ message: "Select a DNS provider" }) }),
      cloudflare: z.object({ api_token: z.string() }),
      clouddns: z.object({ project: z.string(), service_account_json: z.string() })
    })
    .superRefine((value, ctx) => {
      if (value.dns_provider === "cloudflare") {
        if (!value.cloudflare.api_token.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["cloudflare", "api_token"],
            message: "Cloudflare API token is required"
          });
        }
      } else if (value.dns_provider === "clouddns") {
        if (!value.clouddns.project.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["clouddns", "project"],
            message: "GCP project ID is required"
          });
        }
        if (!value.clouddns.service_account_json.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["clouddns", "service_account_json"],
            message: "Service account JSON is required"
          });
        } else if (!isValidServiceAccountJson(value.clouddns.service_account_json)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["clouddns", "service_account_json"],
            message: "Must be valid JSON or base64-encoded JSON"
          });
        }
      }
    });
};

export const CertManagerForm: React.FC<CertManagerFormProps> = ({
  onSubmit,
  acmeEmailMode,
  defaultValues,
  acmeEmailHelpText,
  rootError,
  fieldErrors,
  isSubmitting,
  submitLabel = "Continue",
  onCancel
}) => {
  const schema = React.useMemo(() => buildSchema(acmeEmailMode), [acmeEmailMode]);
  const form = useForm<CertManagerFormValues>({
    resolver: zodResolver(schema),
    mode: "onSubmit",
    defaultValues: {
      acme_email: defaultValues?.acme_email ?? "",
      dns_provider: defaultValues?.dns_provider ?? "",
      cloudflare: { api_token: "" },
      clouddns: { project: "", service_account_json: "" }
    }
  });

  const dnsProvider = form.watch("dns_provider");
  const [showCloudflareToken, setShowCloudflareToken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!fieldErrors) return;
    const fieldMap: Record<string, keyof CertManagerFormValues | string> = {
      "cert_manager.acme_email": "acme_email",
      "cert_manager.dns_provider": "dns_provider",
      "cert_manager.cloudflare.api_token": "cloudflare.api_token",
      "cert_manager.clouddns.project": "clouddns.project",
      "cert_manager.clouddns.service_account_json": "clouddns.service_account_json"
    };
    for (const [apiField, message] of Object.entries(fieldErrors)) {
      const localPath = fieldMap[apiField] ?? apiField.replace(/^cert_manager\./, "");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      form.setError(localPath as any, { type: "server", message });
    }
  }, [fieldErrors, form]);

  const handleSubmit = form.handleSubmit(values => {
    if (values.dns_provider === "cloudflare") {
      const payload: CertManagerPayload = {
        ...(values.acme_email ? { acme_email: values.acme_email } : {}),
        use_staging: false,
        dns_provider: "cloudflare",
        cloudflare: { api_token: values.cloudflare.api_token }
      };
      return onSubmit(payload);
    }
    if (values.dns_provider === "clouddns") {
      const payload: CertManagerPayload = {
        ...(values.acme_email ? { acme_email: values.acme_email } : {}),
        use_staging: false,
        dns_provider: "clouddns",
        clouddns: {
          project: values.clouddns.project,
          service_account_json: values.clouddns.service_account_json
        }
      };
      return onSubmit(payload);
    }
    return undefined;
  });

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text().catch(async () => {
      const base64 = await readFileAsBase64(file);
      return base64;
    });
    form.setValue("clouddns.service_account_json", text, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {rootError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="whitespace-pre-line">{rootError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="acme_email"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Let&apos;s Encrypt notification email{acmeEmailMode === "optional" ? " (optional)" : ""}</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ops@example.com" {...field} />
              </FormControl>
              {acmeEmailHelpText && !fieldState.error && <p className="text-muted-foreground text-xs">{acmeEmailHelpText}</p>}
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />

        <Separator />

        <FormField
          control={form.control}
          name="dns_provider"
          render={({ field, fieldState }) => (
            <FormItem className="space-y-2">
              <FormLabel>DNS provider</FormLabel>
              <FormControl>
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    htmlFor="dns-provider-cloudflare"
                    className="border-muted hover:border-accent [&:has([data-state=checked])]:border-primary cursor-pointer rounded-md border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="dns-provider-cloudflare" value="cloudflare" aria-label="Cloudflare" />
                      <div>
                        <div className="font-medium">Cloudflare</div>
                        <div className="text-muted-foreground text-xs">Requires an API token with Zone:DNS:Edit permission.</div>
                      </div>
                    </div>
                  </label>
                  <label
                    htmlFor="dns-provider-clouddns"
                    className="border-muted hover:border-accent [&:has([data-state=checked])]:border-primary cursor-pointer rounded-md border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem id="dns-provider-clouddns" value="clouddns" aria-label="Google CloudDNS" />
                      <div>
                        <div className="font-medium">Google CloudDNS</div>
                        <div className="text-muted-foreground text-xs">Requires a GCP project and a service account JSON key.</div>
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </FormControl>
              <p className="text-muted-foreground text-xs">
                Only Cloudflare and Google CloudDNS are supported here. For other DNS providers, use the provider CLI to set up TLS certificates.
              </p>
              <FormMessage>{fieldState.error?.message}</FormMessage>
            </FormItem>
          )}
        />

        {dnsProvider === "cloudflare" && (
          <FormField
            control={form.control}
            name="cloudflare.api_token"
            render={({ field, fieldState }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormLabel htmlFor="cloudflare-api-token">Cloudflare API token</FormLabel>
                  <CredentialHelp ariaLabel="How to generate a Cloudflare API token">
                    <CloudflareTokenHelp />
                  </CredentialHelp>
                </div>
                <FormControl>
                  <Input
                    id="cloudflare-api-token"
                    aria-label="Cloudflare API token"
                    type={showCloudflareToken ? "text" : "password"}
                    placeholder="cf-…"
                    autoComplete="off"
                    endIcon={
                      <button
                        type="button"
                        onClick={() => setShowCloudflareToken(prev => !prev)}
                        aria-label={showCloudflareToken ? "Hide token" : "Show token"}
                        className="text-muted-foreground pr-3"
                      >
                        {showCloudflareToken ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    {...field}
                  />
                </FormControl>
                <FormMessage>{fieldState.error?.message}</FormMessage>
              </FormItem>
            )}
          />
        )}

        {dnsProvider === "clouddns" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="clouddns.project"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel htmlFor="clouddns-project">GCP project ID</FormLabel>
                  <FormControl>
                    <Input id="clouddns-project" aria-label="GCP project ID" placeholder="my-gcp-project" {...field} />
                  </FormControl>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clouddns.service_account_json"
              render={({ field, fieldState }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FormLabel htmlFor="clouddns-service-account">Service account JSON</FormLabel>
                      <CredentialHelp ariaLabel="How to generate a GCP service account key">
                        <CloudDnsServiceAccountHelp />
                      </CredentialHelp>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleUploadClick}>
                      <Upload className="mr-2 h-4 w-4" /> Upload .json
                    </Button>
                    <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFileChange} />
                  </div>
                  <FormControl>
                    <Textarea
                      id="clouddns-service-account"
                      aria-label="Service account JSON"
                      placeholder='Paste the JSON key from GCP, or click "Upload .json"'
                      inputClassName="min-h-[160px] font-mono text-xs"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-muted-foreground text-xs">Accepts the raw JSON downloaded from GCP, or the same JSON base64-encoded.</p>
                  <FormMessage>{fieldState.error?.message}</FormMessage>
                </FormItem>
              )}
            />
          </div>
        )}

        <Separator />

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
};
