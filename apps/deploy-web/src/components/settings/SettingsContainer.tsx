"use client";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Edit } from "iconoir-react";
import { useRouter } from "next/navigation";
import { NextSeo } from "next-seo";

import { AutoTopUpSetting } from "@src/components/settings/AutoTopUpSetting/AutoTopUpSetting";
import { AutoTopUpSettingContainer } from "@src/components/settings/AutoTopUpSetting/AutoTopUpSettingContainer";
import { LocalDataManager } from "@src/components/settings/LocalDataManager";
import { Fieldset } from "@src/components/shared/Fieldset";
import { LabelValue } from "@src/components/shared/LabelValue";
import { useWallet } from "@src/context/WalletProvider";
import { useWhen } from "@src/hooks/useWhen";
import networkStore from "@src/store/networkStore";
import Layout from "../layout/Layout";
import { CertificateList } from "./CertificateList";
import CloudmosImportPanel from "./CloudmosImportPanel";
import { ColorModeSelect } from "./ColorModeSelect";
import { SelectNetworkModal } from "./SelectNetworkModal";
import { SettingsForm } from "./SettingsForm";
import { SettingsLayout, SettingsTabs } from "./SettingsLayout";

export const SettingsContainer: React.FunctionComponent = () => {
  const [isSelectingNetwork, setIsSelectingNetwork] = useState(false);
  const selectedNetwork = networkStore.useSelectedNetwork();
  const wallet = useWallet();
  const router = useRouter();

  useWhen(!wallet.isWalletConnected || wallet.isManaged, () => router.push("/"));

  const onSelectNetworkModalClose = () => {
    setIsSelectingNetwork(false);
  };

  return (
    <Layout isUsingSettings>
      <NextSeo title="Settings" />

      <SettingsLayout page={SettingsTabs.GENERAL} title="Settings">
        {isSelectingNetwork && <SelectNetworkModal onClose={onSelectNetworkModalClose} />}
        <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
          <Fieldset label="Network">
            <LabelValue
              value={
                <div className="inline-flex items-center">
                  <strong>{selectedNetwork.title}</strong>

                  <Button onClick={() => setIsSelectingNetwork(true)} size="icon" className="ml-4" variant="outline">
                    <Edit className="text-sm" />
                  </Button>
                </div>
              }
            />

            <SettingsForm />
          </Fieldset>

          <Fieldset label="General">
            <ColorModeSelect />
            <LocalDataManager />
          </Fieldset>

          <Fieldset label="Auto Top Up">
            <AutoTopUpSettingContainer />
          </Fieldset>
        </div>

        <Fieldset label="Certificates" className="mb-4">
          <CertificateList />
        </Fieldset>

        <CloudmosImportPanel />
      </SettingsLayout>
    </Layout>
  );
};
