"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Trash2 } from "lucide-react";

import { SettingsRow } from "@src/components/layout/SettingsCard/SettingsCard";
import type { OrganizationOutput } from "@src/types/organization";
import { DeleteTeamDialog } from "./DeleteTeamDialog";

export const DEPENDENCIES = { DeleteTeamDialog };

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name">;
  dependencies?: typeof DEPENDENCIES;
};

export const DeleteTeamSetting: FC<Props> = ({ organization, dependencies: d = DEPENDENCIES }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <SettingsRow
        label="Delete team"
        description={`Permanently delete ${organization.name} for everyone in it, forfeiting its remaining credits. This can't be undone.`}
      >
        <Button type="button" variant="destructive" size="md" className="gap-1.5" onClick={() => setIsDialogOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete team
        </Button>
      </SettingsRow>
      {isDialogOpen && <d.DeleteTeamDialog organization={organization} onClose={() => setIsDialogOpen(false)} />}
    </>
  );
};
