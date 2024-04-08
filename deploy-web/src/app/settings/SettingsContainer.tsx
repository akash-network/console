"use client";
import { SettingsForm } from "@src/app/settings/SettingsForm";
import { Box, FormControlLabel, IconButton } from "@mui/material";
import { ColorModeSelect } from "@src/components/layout/ColorModeSelect";
import { PageContainer } from "@src/components/shared/PageContainer";
import { SettingsLayout, SettingsTabs } from "@src/app/settings/SettingsLayout";
import { Fieldset } from "@src/components/shared/Fieldset";
import { useState } from "react";
import { SelectNetworkModal } from "@src/components/shared/SelectNetworkModal";
import EditIcon from "@mui/icons-material/Edit";
import { CertificateList } from "@src/components/certificates/CertificateList";
import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";

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
        {/* {isSelectingNetwork && <SelectNetworkModal onClose={onSelectNetworkModalClose} />} */}
        <Box sx={{ gridTemplateColumns: { xs: "repeat(1,1fr)", sm: "repeat(1,1fr)", md: "repeat(2,1fr)" }, display: "grid", gap: "1rem" }}>
          <Fieldset label="Network">
            <FormControlLabel
              control={
                <IconButton onClick={() => setIsSelectingNetwork(true)} sx={{ marginLeft: ".5rem" }} disableRipple>
                  <EditIcon fontSize="small" />
                </IconButton>
              }
              label={
                <Box component="span">
                  Network
                  <Box component="strong" sx={{ marginLeft: "1rem" }}>
                    {selectedNetwork?.title}
                  </Box>
                </Box>
              }
              labelPlacement="start"
              sx={{ marginLeft: 0, marginBottom: "1rem" }}
            />

            <SettingsForm />
          </Fieldset>

          <Fieldset label="General">
            <ColorModeSelect />
          </Fieldset>
        </Box>

        <Fieldset label="Certificates">
          <CertificateList />
        </Fieldset>
      </SettingsLayout>
    </PageContainer>
  );
};
