import type { components } from "@akashnetwork/react-query-sdk/notifications";
import type { GetServerSidePropsResult } from "next/types";
import { z } from "zod";

import { EditNotificationChannelPage } from "@src/components/alerts/EditNotificationChannelPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";

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
  if: async ctx => (await isAuthenticated(ctx)) && (await isFeatureEnabled("alerts", ctx)),
  handler: async (context): Promise<GetServerSidePropsResult<Props>> => {
    const session = (await context.services.getSession(context.req, context.res))!;
    const notificationChannel = await context.services.notificationsApi.v1.getNotificationChannel({
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
});
