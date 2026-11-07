import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "@src/lib/nextjs/pageGuards/pageGuards";
import type { ITemplate } from "@src/types";
import type { TemplateRouteProps } from "./TemplateRoute";

export async function loadTemplateRouteProps(id: string, context: AppTypedContext): Promise<{ props: TemplateRouteProps }> {
  if (await isFeatureEnabled("template_marketplace", context)) return { props: { id, isMarketplace: true } };

  const { services, getCurrentSession } = context;
  const session = await getCurrentSession();
  const config = session ? { headers: { Authorization: `Bearer ${session.accessToken}` } } : {};
  const response = await services.consoleApiHttpClient.get<ITemplate>(
    `${services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID)}/v1/user/template/${id}`,
    config
  );

  return { props: { id, template: response.data } };
}
