"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useUser } from "@src/hooks/useUser";
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
  const user = useUser();
  const { enqueueSnackbar } = useSnackbar();
  const notificator = useNotificator();

  const create = useCallback(
    ({ emails, name }: ContainerCreateInput) => {
      if (user?.id) {
        mutation.mutate({
          body: {
            data: {
              name,
              userId: user.id,
              type: "email",
              config: {
                addresses: emails
              }
            }
          }
        });
      } else {
        enqueueSnackbar(<Snackbar data-testid="contact-point-create-login-required-notification" title="Login required" />, { variant: "error" });
      }
    },
    [enqueueSnackbar, mutation, user]
  );

  useWhen(mutation.isSuccess, () => {
    notificator.success("Contact point created!", { dataTestId: "contact-point-create-success-notification" });
    onCreate();
  });

  useWhen(mutation.isError, () => notificator.error("Failed to create contact point...", { dataTestId: "contact-point-create-error-notification" }));

  return <>{children({ create, isLoading: mutation.isPending })}</>;
};
