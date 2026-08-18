import { isApiError } from "@akashnetwork/openapi-sdk";
import type { GetServerSidePropsResult } from "next/types";
import { z } from "zod";

import type { WalletBalanceAlert } from "@src/components/alerts/EditAlertPage/EditAlertPage";
import { EditAlertPage } from "@src/components/alerts/EditAlertPage/EditAlertPage";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

export default EditAlertPage;

type Props = {
  alert: WalletBalanceAlert;
};

const NOT_FOUND: GetServerSidePropsResult<Props> = {
  notFound: true
};

export const getServerSideProps = defineServerSideProps({
  route: "/alerts/[id]",
  schema: z.object({
    params: z.object({
      id: z.string().uuid()
    })
  }),
  handler: async (context): Promise<GetServerSidePropsResult<Props>> => {
    const session = (await context.services.getSession(context.req, context.res))!;

    let response;
    try {
      response = await context.services.api.v1.getAlert({ id: context.params.id }, { headers: { Authorization: `Bearer ${session.accessToken}` } });
    } catch (error) {
      if (isApiError(error) && error.status === 404) {
        return NOT_FOUND;
      }
      throw error;
    }

    if (response?.data?.type !== "WALLET_BALANCE") {
      return NOT_FOUND;
    }

    return {
      props: {
        alert: response.data
      }
    };
  }
});
