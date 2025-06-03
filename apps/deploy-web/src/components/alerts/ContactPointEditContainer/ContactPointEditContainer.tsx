"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type ContactPointPatchInput = components["schemas"]["ContactPointPatchInput"]["data"];
export type ContainerPatchInput = Pick<ContactPointPatchInput, "name"> & {
  emails: Required<ContactPointPatchInput>["config"]["addresses"];
};

export type ChildrenProps = {
  values?: Required<ContainerPatchInput>;
  onEdit: (input: ContainerPatchInput) => void;
  isLoading: boolean;
};

type ContactPointEditContainerProps = {
  id: string;
  children: (props: ChildrenProps) => ReactNode;
  onEditSuccess: () => void;
};

export const ContactPointEditContainer: FC<ContactPointEditContainerProps> = ({ id, children, onEditSuccess }) => {
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.patchContactPoint.useMutation({
    path: {
      id
    }
  });
  const notificator = useNotificator();

  const edit: ChildrenProps["onEdit"] = useCallback(
    ({ emails, name }) => {
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
      onEditSuccess();
    },
    [mutation.isSuccess, notificator, onEditSuccess]
  );

  useWhen(mutation.isError, () => notificator.error("Failed to save contact point...", { dataTestId: "contact-point-edit-error-notification" }));

  return (
    <>
      {children({
        onEdit: edit,
        isLoading: mutation.isPending
      })}
    </>
  );
};
