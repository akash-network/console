import type { GetServerSidePropsResult } from "next";

import { isMarketplaceEnabled } from "@src/components/templates/visitorPages/resolveMarketplaceAudience";
import type { AppTypedContext } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";
import type { ITemplate } from "@src/types";
import type { MarketplaceTemplate } from "@src/types/marketplace-template";
import type { IUserSetting } from "@src/types/user";
import { UrlService } from "@src/utils/urlUtils";

export type UserProfileRouteProps = {
  username: string;
  user: IUserSetting;
};

/** The API has no lookup from a username to a publisher handle, so the handle is read off the user's public templates, and only off this many. */
const MAX_TEMPLATES_ASKED_FOR_HANDLE = 3;

/** With the marketplace on, a profile whose owner has a publisher page leads there; every other profile keeps the page it always had. */
export async function loadUserProfileRouteProps(username: string, context: AppTypedContext): Promise<GetServerSidePropsResult<UserProfileRouteProps>> {
  const { services } = context;
  const apiUrl = services.apiUrlService.getBaseApiUrlFor(services.privateConfig.NEXT_PUBLIC_MANAGED_WALLET_NETWORK_ID);
  const publisherHandle = (await isMarketplaceEnabled(context)) ? await findPersonalPublisherHandle(username, apiUrl, context) : null;

  if (publisherHandle) return { redirect: { destination: UrlService.templatePublisher(publisherHandle), permanent: false } };

  const { data: user } = await services.consoleApiHttpClient.get<IUserSetting>(`${apiUrl}/v1/user/byUsername/${username}`);

  return { props: { username, user } };
}

async function findPersonalPublisherHandle(username: string, apiUrl: string, { services }: AppTypedContext): Promise<string | null> {
  try {
    const { data: publicTemplates } = await services.consoleApiHttpClient.get<Pick<ITemplate, "id">[]>(
      `${apiUrl}/v1/user/templates/${encodeURIComponent(username)}`
    );

    for (const { id } of publicTemplates.slice(0, MAX_TEMPLATES_ASKED_FOR_HANDLE)) {
      const handle = await readPersonalPublisherHandle(id, apiUrl, services);
      if (handle) return handle;
    }
  } catch (error) {
    services.logger.warn({ event: "PUBLISHER_HANDLE_LOOKUP_FAILED", error });
  }

  return null;
}

/** A template the user wrote inside a team belongs to the team's page, and one that is hidden or removed answers an error: neither names the user's own page. */
async function readPersonalPublisherHandle(templateId: string, apiUrl: string, services: AppTypedContext["services"]): Promise<string | null> {
  try {
    const { data: response } = await services.consoleApiHttpClient.get<{ data: Pick<MarketplaceTemplate, "publisher"> }>(
      `${apiUrl}/v1/user-templates/${encodeURIComponent(templateId)}`
    );
    const publisher = response.data.publisher;

    return publisher?.type === "personal" ? publisher.handle : null;
  } catch {
    return null;
  }
}
