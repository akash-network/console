"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useWhen } from "@src/hooks/useWhen";

type ContactPointCreateInput = components["schemas"]["ContactPointCreateInput"]["data"];
export type ContainerCreateInput = Pick<ContactPointCreateInput, "name"> & {
  emails: ContactPointCreateInput["config"]["addresses"];
};

type ChildrenProps = {
  create: (input: ContainerCreateInput) => void;
  isLoading: boolean;
};

export const ContactPointCreateContainer: FC<{ children: (props: ChildrenProps) => ReactNode; onCreate: () => void }> = ({ children, onCreate }) => {
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.createContactPoint.useMutation();
  const notificator = useNotificator();

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

  useWhen(mutation.isSuccess, () => {
    notificator.success("Contact point created!", { dataTestId: "contact-point-create-success-notification" });
    onCreate();
  });

  useWhen(mutation.isError, () => notificator.error("Failed to create contact point...", { dataTestId: "contact-point-create-error-notification" }));

  return <>{children({ create, isLoading: mutation.isPending })}</>;
};
