"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type ContactPointCreateInput = components["schemas"]["ContactPointCreateInput"]["data"];
type ContactPointOutput = components["schemas"]["ContactPointOutput"]["data"];
export type ContainerCreateInput = Pick<ContactPointCreateInput, "name"> & {
  emails: ContactPointCreateInput["config"]["addresses"];
};

export type ChildrenProps = {
  create: (input: ContainerCreateInput) => void;
  isLoading: boolean;
};

export const ContactPointCreateContainer: FC<{ children: (props: ChildrenProps) => ReactNode; onCreate?: (contactPoint: ContactPointOutput) => void }> = ({
  children,
  onCreate
}) => {
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.createContactPoint.useMutation();
  const notificator = useNotificator();
  const queryClient = useQueryClient();

  const create = useCallback(
    ({ emails, name }: ContainerCreateInput) => {
      mutation.mutate({
        body: {
          data: {
            name,
            type: "email",
            config: {
              addresses: emails
            }
          }
        }
      });
    },
    [mutation]
  );

  useWhen(mutation.isSuccess, async () => {
    notificator.success("Contact point created!", { dataTestId: "contact-point-create-success-notification" });
    await queryClient.invalidateQueries({ queryKey: notificationsApi.v1.getContactPoints.getQueryKey() });
    if (onCreate && mutation?.data?.data) {
      onCreate(mutation.data.data);
    }
  });

  useWhen(mutation.isError, () => notificator.error("Failed to create contact point...", { dataTestId: "contact-point-create-error-notification" }));

  return <>{children({ create, isLoading: mutation.isPending })}</>;
};
