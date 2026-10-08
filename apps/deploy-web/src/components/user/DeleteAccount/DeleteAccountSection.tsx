"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Trash2 } from "lucide-react";

import { SettingsCard, SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export const DEPENDENCIES = { useFlag, DeleteAccountDialog };

type Props = {
  email: string | null | undefined;
  dependencies?: typeof DEPENDENCIES;
};

export const DeleteAccountSection: FC<Props> = ({ email, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const isAccountDeletionEnabled = d.useFlag("account_deletion");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!isAccountDeletionEnabled || !email) return null;

  const openDialog = () => {
    analyticsService.track("account_deletion_modal_opened", { category: "user", label: "Open delete account dialog" });
    setIsDialogOpen(true);
  };

  return (
    <>
      <SettingsSection title="Danger zone">
        <SettingsCard destructive>
          <SettingsRow label="Delete account" description="Permanently delete your Akash Console account and everything stored with it. This can't be undone.">
            <Button type="button" variant="destructive" size="md" className="gap-1.5" onClick={openDialog}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete account
            </Button>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
      {isDialogOpen && <d.DeleteAccountDialog email={email} onClose={() => setIsDialogOpen(false)} />}
    </>
  );
};
