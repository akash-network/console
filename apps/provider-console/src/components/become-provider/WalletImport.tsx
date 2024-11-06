"use client";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Textarea
} from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtom } from "jotai";
import { HomeIcon } from "lucide-react";
import { useRouter } from "next/router";
import { z } from "zod";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useWallet } from "@src/context/WalletProvider";
import providerProcessStore from "@src/store/providerProcessStore";
import { ControlMachineWithAddress } from "@src/types/controlMachine";
import restClient from "@src/utils/restClient";
import { ResetProviderForm } from "./ResetProviderProcess";

function decodeBase64(base64: string): string {
  return Buffer.from(base64, "base64").toString("utf-8");
}

async function encrypt(data: string, publicKey: string): Promise<string> {
  const { default: JSEncrypt } = await import("jsencrypt");
  const encryptor = new JSEncrypt();

  const decodedPublicKey = decodeBase64(publicKey);
  encryptor.setPublicKey(decodedPublicKey);

  const encryptedData = encryptor.encrypt(data);
  if (!encryptedData) {
    throw new Error("Encryption failed");
  }
  return encryptedData;
}

interface WalletImportProps {
  stepChange: () => void;
}

const appearanceFormSchema = z.object({
  walletMode: z.enum(["seed", "manual"], {
    required_error: "Please select a mode."
  })
});

const seedFormSchema = z.object({
  seedPhrase: z.string().refine(
    value => {
      const wordCount = value.trim().split(/\s+/).length;
      return wordCount === 12 || wordCount === 24;
    },
    {
      message: "Seed phrase must be either 12 or 24 words."
    }
  )
});

type AppearanceFormValues = z.infer<typeof appearanceFormSchema>;
type SeedFormValues = z.infer<typeof seedFormSchema>;

export const WalletImport: React.FC<WalletImportProps> = () => {
  const [mode, setMode] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const [providerProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [, resetProviderProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const { setControlMachine } = useControlMachine();
  const { address } = useWallet();

  const defaultValues: Partial<AppearanceFormValues> = {
    walletMode: "seed"
  };

  const form = useForm<AppearanceFormValues>({
    defaultValues
  });

  const seedForm = useForm<SeedFormValues>({
    resolver: zodResolver(seedFormSchema)
  });

  const submitData = async (data: AppearanceFormValues) => {
    setMode(data.walletMode);
  };

  const submitForm = async (data: SeedFormValues) => {
    setIsLoading(true);
    setError(null);
    try {
      if (providerProcess.machines && providerProcess.machines.length > 0) {
        const publicKey = providerProcess.machines[0].systemInfo.public_key;
        const keyId = providerProcess.machines[0].systemInfo.key_id;
        const encryptedSeedPhrase = await encrypt(data.seedPhrase, publicKey);

        const finalRequest = {
          wallet: {
            key_id: keyId,
            wallet_phrase: encryptedSeedPhrase
          },
          nodes: providerProcess.machines.map(machine => ({
            hostname: machine.access.hostname,
            port: machine.access.port,
            username: machine.access.username,
            keyfile: machine.access.file,
            password: machine.access.password,
            install_gpu_drivers: machine.systemInfo.gpu.count > 0 ? true : false
          })),
          provider: {
            attributes: providerProcess.attributes,
            pricing: providerProcess.pricing,
            config: providerProcess.config
          }
        };

        const response: any = await restClient.post("/build-provider", finalRequest, {
          headers: { "Content-Type": "application/json" }
        });

        if (response.action_id) {
          const machineWithAddress: ControlMachineWithAddress = {
            address: address,
            ...providerProcess.machines[0]
          };
          await setControlMachine(machineWithAddress);
          resetProviderProcess();
          router.push(`/actions/${response.action_id}`);
        } else {
          throw new Error("Invalid response from server");
        }
      } else {
        throw new Error("No machine information available");
      }
    } catch (error) {
      console.error("Error during wallet verification:", error);
      setError("An error occurred while processing your request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex flex-col items-center pt-10">
      {!mode && (
        <div className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(submitData)}>
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold">Import Wallet</h3>
                  <p className="text-muted-foreground text-sm">Provider needs to import their wallet into their control machine in order to become provider.</p>
                </div>
                <div className="">
                  <Separator />
                </div>
                <div className="">
                  <FormField
                    control={form.control}
                    name="walletMode"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Wallet Mode</FormLabel>
                        <FormDescription>Choose which mode do you want to use to import wallet</FormDescription>
                        <FormMessage />
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid max-w-md grid-cols-2 gap-8 pt-2">
                          <FormItem>
                            <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                              <FormControl>
                                <RadioGroupItem value="seed" className="sr-only" />
                              </FormControl>
                              <div className="border-muted hover:border-accent items-center rounded-md border-2 p-1">
                                <div className="space-y-2 rounded-sm p-2">
                                  <div className="space-y-2 rounded-md p-4 shadow-sm">
                                    <HomeIcon />
                                    <h4 className="text-md">Seed Phrase Mode</h4>
                                    <p>Provider Console will auto import using secure end-to-end encryption. Seed Phrase is Required.</p>
                                  </div>
                                </div>
                              </div>
                            </FormLabel>
                          </FormItem>
                          <FormItem>
                            <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                              <FormControl>
                                <RadioGroupItem value="manual" className="sr-only" />
                              </FormControl>
                              <div className="border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1">
                                <div className="space-y-2 rounded-sm bg-slate-950 p-2">
                                  <div className="space-y-2 rounded-sm bg-slate-800 p-4 text-white">
                                    <HomeIcon />
                                    <h4 className="text-md">Manual Mode</h4>
                                    <p>You need to login to control machine and follow the instruction to import wallet. Seed Phrase is not Required.</p>
                                  </div>
                                </div>
                              </div>
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="">
                  <Separator />
                </div>
                <div className="flex w-full justify-between">
                  <div className="flex justify-start">
                    <ResetProviderForm />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" onClick={form.handleSubmit(submitData)}>
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </div>
      )}

      {mode === "seed" && (
        <div className="space-y-6">
          <Form {...seedForm}>
            <form onSubmit={seedForm.handleSubmit(submitForm)} className="space-y-6">
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold">Seed Mode - Import Wallet</h3>
                  <p className="text-muted-foreground text-sm">Seed Mode uses end-to-end encryption to ensure secure wallet import in your machine.</p>
                </div>
                <div className="">
                  <Separator />
                </div>
                <div className="">
                  <FormField
                    control={seedForm.control}
                    name="seedPhrase"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-2">
                        <FormLabel>Seed Phrase</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter your seed phrase" {...field} rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="">
                  <Separator />
                </div>
                <div className="flex w-full justify-between">
                  <div className="flex justify-start">
                    <ResetProviderForm />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? "Loading..." : "Next"}
                    </Button>
                  </div>
                  {error && (
                    <div className="mt-4 w-full">
                      <p className="text-sm text-red-500">{error || "An error occurred during wallet import."}</p>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </Form>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold">Manual Mode - Import Wallet</h3>
            <p className="text-muted-foreground text-sm">Follow these instructions to manually import your wallet on your machine.</p>
          </div>
          <div>
            <Separator />
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Instructions:</h4>
            <ol className="list-decimal space-y-2 pl-6">
              <li>Open a terminal on your machine.</li>
              <li>Navigate to your control machine's directory root.</li>
              <li>
                Run the following command to import your wallet:
                <div className="bg-secondary mt-2 rounded-md p-4">
                  <code className="text-sm">~/bin/provider-services --keyring-backend file keys add wallet_name --recover</code>
                </div>
              </li>
              <li>
                Run the following command to import your wallet:
                <div className="bg-secondary mt-2 rounded-md p-4">
                  <code className="text-sm">echo passphrase &gt; ~/.praetor/wallet_phrase_password.txt</code>
                </div>
              </li>
            </ol>
            <p className="text-muted-foreground text-sm">Replace "/path/to/your/keyfile" with the actual path to your keyfile.</p>
            <p className="text-sm">You will be prompted to enter your keyfile password. Enter it carefully.</p>
          </div>
          <div>
            <Separator />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                // TODO: Verify Manual Wallet Import
                console.log("Manual Wallet Import");
              }}
            >
              Verify Wallet Import
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
