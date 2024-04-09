"use client";
import { SettingsForm } from "@src/app/settings/SettingsForm";
import { ColorModeSelect } from "@src/components/layout/ColorModeSelect";
import { PageContainer } from "@src/components/shared/PageContainer";
import { SettingsLayout, SettingsTabs } from "@src/app/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { useState } from "react";
import { CertificateList } from "@src/components/certificates/CertificateList";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Button } from "@src/components/ui/button";
import { Edit } from "iconoir-react";
import { SelectNetworkModal } from "@src/components/shared/SelectNetworkModal";

type Props = {};

export const SettingsContainer: React.FunctionComponent<Props> = ({}) => {
  const [isSelectingNetwork, setIsSelectingNetwork] = useState(false);
  const selectedNetwork = useSelectedNetwork();

  const onSelectNetworkModalClose = () => {
    setIsSelectingNetwork(false);
  };

  return (
    <PageContainer className="pt-6" isUsingSettings>
      <SettingsLayout page={SettingsTabs.GENERAL} title="Settings">
        {isSelectingNetwork && <SelectNetworkModal onClose={onSelectNetworkModalClose} />}
        <div className="grid-col-1 mb-4 grid gap-4 md:grid-cols-2">
          <Fieldset label="Network">
            <LabelValue
              value={
                <div className="inline-flex items-center">
                  <strong>{selectedNetwork?.title}</strong>

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
          </Fieldset>
        </div>

        <Fieldset label="Certificates">
          <CertificateList />
        </Fieldset>
      </SettingsLayout>
    </PageContainer>
  );
};
