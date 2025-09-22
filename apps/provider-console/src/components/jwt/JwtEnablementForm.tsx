import React from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from "@akashnetwork/ui/components";
import { Refresh } from "iconoir-react";

import { useEnableJwt } from "@src/queries/useJwtQuery";
import { DNS_PROVIDERS, type DnsProvider, type JwtEnablementFormData } from "@src/types/jwt";

interface JwtEnablementFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const JwtEnablementForm: React.FC<JwtEnablementFormProps> = ({ onSuccess, onCancel }) => {
  const enableJwtMutation = useEnableJwt();
  const [selectedProvider, setSelectedProvider] = React.useState<DnsProvider | null>(null);

  const form = useForm<JwtEnablementFormData>({
    defaultValues: {
      email: "",
      provider_info: {
        provider: "cloudflare",
        apiToken: ""
      }
    },
    mode: "onChange"
  });

  const watchedProvider = form.watch("provider_info.provider");

  React.useEffect(() => {
    setSelectedProvider(watchedProvider);

    // Reset form with appropriate default values for the selected provider
    if (watchedProvider === "cloudflare") {
      form.reset({
        email: form.getValues("email") || "",
        provider_info: {
          provider: "cloudflare",
          apiToken: ""
        }
      });
    } else if (watchedProvider === "googleCloud") {
      form.reset({
        email: form.getValues("email") || "",
        provider_info: {
          provider: "googleCloud",
          projectId: "",
          privateKeyId: "",
          privateKey: "",
          clientEmail: "",
          clientId: "",
          authUri: "https://accounts.google.com/o/oauth2/auth",
          tokenUri: "https://oauth2.googleapis.com/token",
          authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
          clientX509CertUrl: ""
        }
      });
    }
  }, [watchedProvider, form]);

  const onSubmit = (data: JwtEnablementFormData) => {
    enableJwtMutation.mutate(data, {
      onSuccess: () => {
        onSuccess?.();
      }
    });
  };

  const isLoading = enableJwtMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* DNS Provider Selection */}
        <FormField
          control={form.control}
          name="provider_info.provider"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DNS Provider</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="w-fit min-w-[200px]">
                    <SelectValue placeholder="Select DNS provider" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DNS_PROVIDERS.map(provider => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Email Field (Common for both providers) */}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input type="email" placeholder="your-email@example.com" required {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cloudflare-specific fields */}
        {selectedProvider === "cloudflare" && (
          <FormField
            control={form.control}
            name="provider_info.apiToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cloudflare API Token</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Your Cloudflare API token" required {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Google Cloud-specific fields */}
        {selectedProvider === "googleCloud" && (
          <>
            <FormField
              control={form.control}
              name="provider_info.projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project ID</FormLabel>
                  <FormControl>
                    <Input placeholder="your-project-id" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_info.privateKeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private Key ID</FormLabel>
                  <FormControl>
                    <Input placeholder="your-private-key-id" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_info.privateKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Private Key</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"
                      className="min-h-[100px]"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_info.clientEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="your-service-account@your-project-id.iam.gserviceaccount.com" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_info.clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client ID</FormLabel>
                  <FormControl>
                    <Input placeholder="your-client-id" required {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="provider_info.clientX509CertUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client X509 Cert URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project-id.iam.gserviceaccount.com"
                      required
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Refresh className="mr-2 h-4 w-4 animate-spin" />
                Enabling JWT...
              </>
            ) : (
              "Enable JWT"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
