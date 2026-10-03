"use client";

import type { FC } from "react";
import React from "react";
import type { components } from "@akashnetwork/console-api-types/notifications";
import { DialogV2, DialogV2Content, DialogV2Description, DialogV2Header, DialogV2Title } from "@akashnetwork/ui/components";

import { NotificationChannelCreateContainer } from "@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer";
import { NotificationChannelEditContainer } from "@src/components/alerts/NotificationChannelEditContainer/NotificationChannelEditContainer";
import { NotificationChannelForm } from "@src/components/alerts/NotificationChannelForm/NotificationChannelForm";

type NotificationChannel = components["schemas"]["NotificationChannelOutput"]["data"];

export const DEPENDENCIES = { NotificationChannelCreateContainer, NotificationChannelEditContainer, NotificationChannelForm };

type Props = {
  notificationChannel?: NotificationChannel;
  onCreate?: (notificationChannel: NotificationChannel) => void;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const NotificationChannelDialog: FC<Props> = ({ notificationChannel, onCreate, onClose, dependencies: d = DEPENDENCIES }) => {
  return (
    <DialogV2 open onOpenChange={isOpen => !isOpen && onClose()}>
      <DialogV2Content className="max-w-[460px]">
        <DialogV2Header>
          <DialogV2Title>{notificationChannel ? "Edit notification channel" : "Add notification channel"}</DialogV2Title>
          <DialogV2Description>Alerts that use this channel are emailed to every address listed.</DialogV2Description>
        </DialogV2Header>
        {notificationChannel ? (
          <d.NotificationChannelEditContainer id={notificationChannel.id} onEditSuccess={onClose}>
            {props => (
              <d.NotificationChannelForm
                initialValues={{ name: notificationChannel.name, emails: notificationChannel.config.addresses }}
                submitLabel="Save changes"
                isLoading={props.isLoading}
                onSubmit={props.onEdit}
                onCancel={onClose}
              />
            )}
          </d.NotificationChannelEditContainer>
        ) : (
          <d.NotificationChannelCreateContainer
            onCreate={createdChannel => {
              onCreate?.(createdChannel);
              onClose();
            }}
          >
            {props => <d.NotificationChannelForm submitLabel="Add channel" isLoading={props.isLoading} onSubmit={props.create} onCancel={onClose} />}
          </d.NotificationChannelCreateContainer>
        )}
      </DialogV2Content>
    </DialogV2>
  );
};
