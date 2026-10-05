"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";

import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export const DEPENDENCIES = { useFlag, DeleteAccountDialog };

type Props = {
  email: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DeleteAccountSection: FC<Props> = ({ email, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const isAccountDeletionEnabled = d.useFlag("account_deletion");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  if (!isAccountDeletionEnabled) return null;

  const openDialog = () => {
    analyticsService.track("account_deletion_modal_opened", { category: "user", label: "Open delete account dialog" });
    setIsDialogOpen(true);
  };

  return (
    <>
      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/50 bg-card p-6">
        <div className="space-y-1">
          <h3 className="font-semibold">Delete account</h3>
          <p className="text-sm text-muted-foreground">
            Permanently delete your Akash Console account and everything stored with it. This can&apos;t be undone.
          </p>
        </div>
        <Button type="button" variant="destructive" onClick={openDialog}>
          Delete account
        </Button>
      </section>
      {isDialogOpen && <d.DeleteAccountDialog email={email} onClose={() => setIsDialogOpen(false)} />}
    </>
  );
};
