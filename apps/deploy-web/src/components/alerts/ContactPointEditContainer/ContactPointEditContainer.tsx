"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useParams } from "next/navigation";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type ContactPointPatchInput = components["schemas"]["ContactPointPatchInput"]["data"];
export type ContainerPatchInput = Pick<ContactPointPatchInput, "name"> & {
  emails: Required<ContactPointPatchInput>["config"]["addresses"];
};

type ChildrenProps = {
  values: Required<ContainerPatchInput>;
  onEdit: (input: ContainerPatchInput) => void;
  isLoading: boolean;
};

export const ContactPointEditContainer: FC<{ children: (props: ChildrenProps) => ReactNode; onEdit: () => void }> = ({ children, onEdit }) => {
  const { notificationsApi } = useServices();
  const { id } = useParams();
  const mutation = notificationsApi.v1.patchContactPoint.useMutation({
    path: {
      id
    }
  });
  const query = notificationsApi.v1.getContactPoint.useQuery({
    path: {
      id
    }
  });
  const notificator = useNotificator();

  const edit = useCallback(
    ({ emails, name }: ContainerPatchInput) => {
      mutation.mutate({
        data: {
          name,
          config: {
            addresses: emails
          }
        }
      });
    },
    [mutation]
  );

  useWhen(
    mutation.isSuccess,
    () => {
      notificator.success("Contact point saved!", { dataTestId: "contact-point-edit-success-notification" });
      onEdit();
    },
    [mutation.isSuccess, notificator, onEdit]
  );

  useWhen(mutation.isError, () => notificator.error("Failed to save contact point...", { dataTestId: "contact-point-edit-error-notification" }));

  return (
    <>
      {children({
        values: {
          name: query.data?.data.name ?? "",
          emails: query.data?.data.config.addresses.join(",") ?? ""
        },
        onEdit: edit,
        isLoading: mutation.isPending
      })}
    </>
  );
};
