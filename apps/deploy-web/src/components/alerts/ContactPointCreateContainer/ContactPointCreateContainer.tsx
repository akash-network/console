"use client";

import type { FC, ReactNode } from "react";
import React from "react";
import { useCallback } from "react";
import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { Snackbar } from "@akashnetwork/ui/components";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import type { ContactPointFormProps } from "../ContactPointForm";

type ContactPointCreateInput = components["schemas"]["ContactPointCreateInput"]["data"];
type ContainerCreateInput = Pick<ContactPointCreateInput, "name"> & {
  emails: ContactPointCreateInput["config"]["addresses"];
};

type ChildrenProps = {
  create: (input: ContainerCreateInput) => void;
  goBack: ContactPointFormProps["onCancel"];
  isLoading: boolean;
};

export const ContactPointCreateContainer: FC<{ children: (props: ChildrenProps) => ReactNode }> = ({ children }) => {
  const router = useRouter();
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
        enqueueSnackbar(<Snackbar title="Login required" />, { variant: "error" });
      }
    },
    [enqueueSnackbar, mutation, user?.id]
  );

  useWhen(mutation.isSuccess, () => {
    notificator.success("Contact point created!");
    router.push("./");
  });

  useWhen(mutation.isError, () => notificator.error("Failed to create contact point..."));

  const goBack: ContactPointFormProps["onCancel"] = useCallback(() => router.push("./"), [router]);

  return <>{children({ create, goBack, isLoading: mutation.isPending })}</>;
};
