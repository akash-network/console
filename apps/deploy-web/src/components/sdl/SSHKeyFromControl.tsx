import type { FC } from "react";
import { useCallback, useState } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";
import { Button, CustomTooltip, FormField, FormInput } from "@akashnetwork/ui/components";
import { saveAs } from "file-saver";
import { InfoCircle, Key } from "iconoir-react";
import JSZip from "jszip";
import forge from "node-forge";

import { CodeSnippet } from "@src/components/shared/CodeSnippet";
import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import type { SdlBuilderFormValuesType } from "@src/types";

interface SSHKeyInputProps {
  control: Control<SdlBuilderFormValuesType, any>;
  serviceIndex: number;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
}

export const SSHKeyFormControl: FC<SSHKeyInputProps> = ({ control, serviceIndex, setValue }) => {
  const { imageList } = useSdlBuilder();
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateSSHKeys = useCallback(async () => {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    const publicKey = forge.ssh.publicKeyToOpenSSH(keys.publicKey);

    setValue(`services.${serviceIndex}.sshPubKey`, publicKey);

    const zip = new JSZip();
    zip.file("id_rsa.pub", publicKey);
    zip.file("id_rsa", forge.ssh.privateKeyToOpenSSH(keys.privateKey));
    const content = await zip.generateAsync({ type: "blob" });

    saveAs(content, "keypair.zip");

    setHasGenerated(true);
  }, [serviceIndex, setValue]);

  return (
    <div>
      <FormField
        control={control}
        name={`services.${serviceIndex}.sshPubKey`}
        render={({ field }) => (
          <FormInput
            type="text"
            label={
              <div className="inline-flex items-center">
                <strong>SSH Public Key</strong>
                <CustomTooltip
                  title={
                    <>
                      SSH Public Key
                      <br />
                      <br />
                      The key is added to environment variables of the container and then to ~/.ssh/authorized_keys on startup.
                    </>
                  }
                >
                  <InfoCircle className="ml-2 text-xs text-muted-foreground" />
                </CustomTooltip>
              </div>
            }
            placeholder="Enter your own pub key: ssh-.."
            className="flex-grow"
            inputClassName="pr-[100px]"
            value={field.value}
            onChange={event => field.onChange(event.target.value || "")}
            startIcon={<Key className="ml-2 text-xs text-muted-foreground" />}
            data-testid="ssh-public-key-input"
          />
        )}
      />

      <div className="mt-2 flex items-center justify-end space-x-2">
        <span className="text-sm text-muted-foreground">Or</span>
        <Button onClick={generateSSHKeys} type="button" size="xs" data-testid="generate-ssh-keys-btn">
          Generate new key
        </Button>
      </div>

      {hasGenerated && (
        <div className="mt-2 text-sm text-muted-foreground">
          <h4 className="text-lg">How to use</h4>
          <p className="mt-2">The generated SSH key pair is used to access the container via SSH. Here are generalized steps to use them:</p>
          <ul className="list-inside list-disc space-y-1 text-gray-500 dark:text-gray-400">
            <li>
              Download the key pair and extract it.
              <CodeSnippet code="unzip ~/Downloads/keypair.zip" />
            </li>
            <li>
              Copy the private key file to <code>~/.ssh/id_rsa</code> on your local machine.
              <CodeSnippet code="mv ~/Downloads/keypair/* ~/.ssh/" />
            </li>
            <li>
              Make sure to set the correct permissions on the private key file:
              <CodeSnippet code="chmod 600 ~/.ssh/id_rsa" />
            </li>
            <li>Check out more instructions on deployment page in the Lease tab.</li>
          </ul>
          <p className="mt-2">Note: the above is valid for unix operating system</p>
          {!imageList && <p className="mt-2">Note: make sure your image has ssh configured</p>}
        </div>
      )}
    </div>
  );
};
