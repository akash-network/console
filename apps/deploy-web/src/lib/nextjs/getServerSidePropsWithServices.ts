import type { GetServerSideProps, GetServerSidePropsContext, PreviewData } from "next";
import type { ParsedUrlQuery } from "querystring";

import { services } from "../../services/http/http-server.service";
import { createRequestExecutionContext, requestExecutionContext } from "./requestExecutionContext";

export function getServerSidePropsWithServices<
  Props extends Record<string, any> = Record<string, any>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
  Context extends ServerServicesContext<Params, Preview> = ServerServicesContext<Params, Preview>
>(fn: (context: Context) => ReturnType<GetServerSideProps<Props, Params, Preview>>): GetServerSideProps<Props, Params, Preview> {
  return context => {
    return requestExecutionContext.run(
      createRequestExecutionContext(context.req),
      async () =>
        await fn({
          ...context,
          services
        } as Context)
    );
  };
}

export type ServerServicesContext<Params extends ParsedUrlQuery = ParsedUrlQuery, Preview extends PreviewData = PreviewData> = GetServerSidePropsContext<
  Params,
  Preview
> & { services: typeof services };
