import { UrlService } from "@src/utils/urlUtils";
import { Metadata, ResolvingMetadata } from "next";
import { BASE_API_MAINNET_URL } from "@src/utils/constants";
import { getShortText } from "@src/hooks/useShortText";
import { getSession } from "@auth0/nextjs-auth0";
import { ITemplate } from "@src/types";
import { UserTemplate } from "./UserTemplate";

interface ITemplateDetailPageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params: { id } }: ITemplateDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.template(id)}`;
  const template = await fetchTemplateDetail(id);

  return {
    title: `${template.title}`,
    description: getShortText(template.description || "", 140),
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}

async function fetchTemplateDetail(templateId: string): Promise<ITemplate> {
  const session = await getSession();
  let config = {};

  if (session) {
    config = {
      headers: {
        Authorization: session ? `Bearer ${session.accessToken}` : ""
      }
    };
  }

  const response = await fetch(`${BASE_API_MAINNET_URL}/user/template/${templateId}`, config);

  if (!response.ok) {
    // This will activate the closest `error.js` Error Boundary
    throw new Error("Error fetching template detail data");
  }

  return await response.json();
}

export default async function TemplateDetailPage({ params: { id } }: ITemplateDetailPageProps) {
  const template = await fetchTemplateDetail(id);

  return <UserTemplate id={id} template={template} />;
}
