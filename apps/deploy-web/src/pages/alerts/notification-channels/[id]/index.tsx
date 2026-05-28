import type { components } from "@akashnetwork/console-api-types/notifications";
import { isApiError } from "@akashnetwork/openapi-sdk";
import type { GetServerSidePropsResult } from "next/types";
import { z } from "zod";

import { EditNotificationChannelPage } from "@src/components/alerts/EditNotificationChannelPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

export default EditNotificationChannelPage;

type Props = {
  notificationChannel: components["schemas"]["NotificationChannelOutput"]["data"];
};

const NOT_FOUND: GetServerSidePropsResult<Props> = {
  notFound: true
};

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/notification-channels/[id]",
  schema: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),
  if: async ctx => await isFeatureEnabled("alerts", ctx),
  handler: async (context): Promise<GetServerSidePropsResult<Props>> => {
    const session = (await context.services.getSession(context.req, context.res))!;

    let notificationChannel;
    try {
      notificationChannel = await context.services.api.v1.getNotificationChannel(
        { id: context.params.id },
        { headers: { Authorization: `Bearer ${session.accessToken}` } }
      );
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        return NOT_FOUND;
      }
      throw error;
    }

    if (!notificationChannel?.data) {
      return NOT_FOUND;
    }

    return {
      props: {
        notificationChannel: notificationChannel.data
      }
    };
  }
});
