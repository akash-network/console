"use client";

import type { FC } from "react";
import React from "react";
import { useCallback } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useNotificator } from "@src/hooks/useNotificator";
import { useUser } from "@src/hooks/useUser";
import { useWhen } from "@src/hooks/useWhen";
import type { ContactPointFormProps } from "./ContactPointForm";
import { ContactPointForm } from "./ContactPointForm";

export const CreateContactPointFormContainer: FC = () => {
  const router = useRouter();
  const { notificationsApi } = useServices();
  const mutation = notificationsApi.v1.createContactPoint.useMutation();
  const user = useUser();
  const { enqueueSnackbar } = useSnackbar();
  const notificator = useNotificator();
  const { confirm } = usePopup();

  const create: ContactPointFormProps["onSubmit"] = useCallback(
    ({ emails, name }) => {
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

  const cancel: ContactPointFormProps["onCancel"] = useCallback(
    async ({ hasChanges }) => {
      const canCancel = !hasChanges || (await confirm("Unsaved changes would be lost. Are you sure you want to cancel?"));

      if (canCancel) {
        router.push("./");
      }
    },
    [confirm, router]
  );

  return <ContactPointForm onSubmit={create} onCancel={cancel} />;
};
