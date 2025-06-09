import type { components } from "@akashnetwork/react-query-sdk/notifications";
import { getSession } from "@auth0/nextjs-auth0";
import type { GetServerSideProps } from "next";
import type { GetServerSidePropsResult } from "next/types";
import { z } from "zod";

import { EditNotificationChannelPage } from "@src/components/alerts/EditNotificationChannelPage";
import type { ServerServicesContext } from "@src/lib/nextjs/getServerSidePropsWithServices";
import { getValidatedServerSideProps, type ValidatedServerSideContext } from "@src/lib/nextjs/getValidatedServerSideProps";
import { featureFlagService } from "@src/services/feature-flag";
import { notificationsApi } from "@src/services/server-side-notifications-api/server-side-notifications-api.service";

export default EditNotificationChannelPage;

const contextSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

type Props = {
  notificationChannel: components["schemas"]["NotificationChannelOutput"]["data"];
};

const NOT_FOUND: GetServerSidePropsResult<Props> = {
  notFound: true
};

export const getServerSideProps: GetServerSideProps<Props> = getValidatedServerSideProps(
  contextSchema,
  async (context: ServerServicesContext & ValidatedServerSideContext<typeof contextSchema>) => {
    const isEnabled = await featureFlagService.isEnabledForCtx("alerts", context);

    if (!isEnabled) {
      return NOT_FOUND;
    }

    const session = await getSession(context.req, context.res);

    if (!session?.user) {
      return NOT_FOUND;
    }

    const notificationChannel = await notificationsApi.v1.getNotificationChannel({
      parameters: {
        path: {
          id: context.params.id
        },
        header: {
          Authorization: `Bearer ${session.accessToken}`
        }
      }
    });

    if (!notificationChannel.data?.data) {
      return NOT_FOUND;
    }

    return {
      props: {
        notificationChannel: notificationChannel.data?.data
      }
    };
  }
);
