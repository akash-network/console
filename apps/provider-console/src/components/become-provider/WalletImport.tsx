"use client";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Button,
  Form,
  FormControl,
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
import { Check, Copy, QuestionMark, RefreshDouble } from "iconoir-react";
import { useAtom } from "jotai";
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
  onComplete: () => void;
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

export const WalletImport: React.FC<WalletImportProps> = ({ onComplete }) => {
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

  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedPassphrase, setCopiedPassphrase] = useState(false);

  const handleCopy = (text: string, setCopied: React.Dispatch<React.SetStateAction<boolean>>) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 5000);
  };

  const submitData = async (data: AppearanceFormValues) => {
    setMode(data.walletMode);
  };

  const createFinalRequest = (wallet: any) => ({
    wallet,
    nodes: providerProcess.machines.map(machine => ({
      hostname: machine.access.hostname,
      port: machine.access.port,
      username: machine.access.username,
      keyfile: machine.access.file,
      passphrase: machine.access.passphrase,
      password: machine.access.password,
      install_gpu_drivers: machine.systemInfo.gpu.count > 0
    })),
    provider: {
      attributes: providerProcess.attributes,
      pricing: providerProcess.pricing,
      config: providerProcess.config
    }
  });

  const submitForm = async (data: SeedFormValues | null = null) => {
    setIsLoading(true);
    setError(null);
    try {
      if (providerProcess.machines && providerProcess.machines.length > 0) {
        const keyId = providerProcess.machines[0].systemInfo.key_id;
        let finalRequest;
        if (mode === "seed") {
          const publicKey = providerProcess.machines[0].systemInfo.public_key;
          const encryptedSeedPhrase = await encrypt(data?.seedPhrase || "", publicKey);

          const wallet = {
            key_id: keyId,
            wallet_phrase: encryptedSeedPhrase,
            import_mode: "auto"
          };

          finalRequest = createFinalRequest(wallet);
        } else {
          const wallet = {
            key_id: keyId,
            import_mode: "manual"
          };

          finalRequest = createFinalRequest(wallet);
        }
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
          router.push(`/activity-logs/${response.action_id}`);
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
      onComplete();
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
                  <p className="text-muted-foreground text-sm">
                    A wallet is necessary in order to bid on workloads and to receive funds from deployments (tenants/users).
                  </p>
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
                        <FormMessage />
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid max-w-md grid-cols-2 gap-8 pt-2">
                          <FormItem>
                            <FormLabel className="[&:has([data-state=checked])>div]:border-primary">
                              <FormControl>
                                <RadioGroupItem value="seed" className="sr-only" />
                              </FormControl>
                              <div className="border-muted hover:border-accent items-center rounded-md border-2 p-1">
                                <div className="space-y-2 rounded-sm p-2">
                                  <div
                                    className={`space-y-2 rounded-sm p-4 ${field.value === "seed" ? "bg-slate-900 text-white" : "bg-slate-700 text-gray-300"}`}
                                  >
                                    <RefreshDouble />
                                    <h4 className="text-md">Auto Import</h4>
                                    <p>
                                      Console will auto import your wallet into your control node of the provider. Please have wallet seed phrase handy to enter
                                      in the next screen.
                                    </p>
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
                              <div className="border-muted hover:border-accent items-center rounded-md border-2 p-1">
                                <div className="space-y-2 rounded-sm p-2">
                                  <div
                                    className={`space-y-2 rounded-sm p-4 ${
                                      field.value === "manual" ? "bg-slate-900 text-white" : "bg-slate-700 text-gray-300"
                                    }`}
                                  >
                                    <QuestionMark />
                                    <h4 className="text-md">Manual Import</h4>
                                    <p>
                                      You will need to manually import your wallet into your control node of the provider. Please follow the instruction in the
                                      next screen.
                                    </p>
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
                  <h3 className="text-xl font-bold">Auto Import Wallet</h3>
                  <p className="text-muted-foreground text-sm">Uses secure end-to-end encryption to import your wallet into control node of your provider.</p>
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
            </form>
          </Form>
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-bold">Manual Import</h3>
            <p className="text-muted-foreground text-sm">Follow these instructions to manually import your wallet on the control node of your provider.</p>
          </div>
          <div>
            <Separator />
          </div>
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Instructions:</h4>
            <ol className="list-decimal space-y-2 pl-6">
              <li>Open a Terminal: On your computer, open the terminal app.</li>
              <li>
                Go to your control node's root directory
                <div className="bg-secondary relative mt-2 rounded-md p-4">
                  <code className="text-sm">cd ~</code>
                  <Button variant="ghost" size="sm" className="absolute right-2 top-2" onClick={() => handleCopy("cd ~", setCopiedCommand)}>
                    {copiedCommand ? <Check className="text-green-500" /> : <Copy />}
                  </Button>
                </div>
              </li>
              <li>
                Run This Command: Copy and paste the following command into the terminal, then press Enter:
                <div className="bg-secondary relative mt-2 rounded-md p-4">
                  <code className="text-sm">~/bin/provider-services keys add provider --recover --keyring-backend file</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2"
                    onClick={() => handleCopy("~/bin/provider-services keys add provider --recover --keyring-backend file", setCopiedCommand)}
                  >
                    {copiedCommand ? <Check className="text-green-500" /> : <Copy />}
                  </Button>
                </div>
              </li>
              <li>
                Enter Your Wallet Details:
                <ol className="mt-2 list-decimal space-y-2 pl-6">
                  <li>
                    First, it will ask for your 12 or 24-word mnemonic phrase. <br />
                    Type or paste the seed phrase for the wallet you want to import and press Enter. <br />
                    Next, it will ask for your wallet passphrase.{" "}
                  </li>
                  <li>
                    Copy and paste the passphrase below and press Enter:
                    <div className="bg-secondary relative mt-2 rounded-md p-4">
                      <code className="text-sm">{providerProcess?.machines[0]?.systemInfo?.key_id}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-2 top-2"
                        onClick={() => handleCopy(providerProcess?.machines[0]?.systemInfo?.key_id || "", setCopiedPassphrase)}
                      >
                        {copiedPassphrase ? <Check className="text-green-500" /> : <Copy />}
                      </Button>
                    </div>
                  </li>
                </ol>
              </li>
            </ol>
          </div>
          <div>
            <Separator />
          </div>
          <div className="flex w-full justify-between">
            <div className="flex justify-start">
              <ResetProviderForm />
            </div>
            <button type="button" onClick={() => setMode("seed")} className="hover:text-primary/80 text-sm">
              Switch to auto import
            </button>
            <Button type="button" onClick={() => submitForm()} disabled={isLoading}>
              {isLoading ? "Loading..." : "Verify Wallet Import"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
