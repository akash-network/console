"use client";
import type { FC } from "react";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";
import {
  Button,
  DialogV2,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton,
  Snackbar
} from "@akashnetwork/ui/components";
import { LogOut } from "lucide-react";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useLeaveOrganizationMutation } from "@src/queries/useOrganizationQueries";
import type { OrganizationOutput } from "@src/types/organization";
import { OWNER_CANNOT_LEAVE_ERROR_CODE } from "@src/types/organizationMembership";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useActiveOrganization, useLeaveOrganizationMutation, useSnackbar, useRouter };

type Props = {
  organization: Pick<OrganizationOutput, "id" | "name">;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const LeaveOrganizationDialog: FC<Props> = ({ organization, onClose, dependencies: d = DEPENDENCIES }) => {
  const { organizations, switchOrganization } = d.useActiveOrganization();
  const { enqueueSnackbar } = d.useSnackbar();
  const router = d.useRouter();
  const { mutate: leaveOrganization, isPending } = d.useLeaveOrganizationMutation();
  const personalOrganization = organizations.find(candidate => candidate.type === "personal");

  const landInPersonalAccount = () => {
    enqueueSnackbar(<Snackbar title={`You left ${organization.name}`} subTitle="You're in your personal account now." iconVariant="success" />, {
      variant: "success"
    });
    if (!personalOrganization || !switchOrganization(personalOrganization.id)) router.replace(UrlService.home());
  };

  const reportFailure = (error: unknown) => {
    const title =
      extractApiErrorCode(error) === OWNER_CANNOT_LEAVE_ERROR_CODE
        ? `You own ${organization.name}. Transfer ownership before you leave.`
        : `Couldn't leave ${organization.name}`;
    enqueueSnackbar(<Snackbar title={title} iconVariant="error" />, { variant: "error" });
  };

  const leave = () => leaveOrganization({ id: organization.id }, { onSuccess: landInPersonalAccount, onError: reportFailure });

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isPending ? onClose() : undefined)}>
      <DialogV2Content className="max-w-[440px]" hideCloseButton={isPending}>
        <DialogV2Header>
          <DialogV2Title>Leave {organization.name}?</DialogV2Title>
          <DialogV2Description>
            You lose access to <strong className="text-foreground">{organization.name}</strong> and its projects right away. Deployments keep running, and an
            admin can invite you back.
          </DialogV2Description>
        </DialogV2Header>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="button" variant="destructive" loading={isPending} onClick={leave}>
            <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
            Leave organization
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
