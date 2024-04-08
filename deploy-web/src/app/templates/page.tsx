import { UrlService } from "@src/utils/urlUtils";
import { TemplateGallery } from "./TemplateGallery";
import { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const url = `https://deploy.cloudmos.io${UrlService.templates()}`;

  return {
    title: "Template Gallery",
    description: "Explore all the templates made by the community to easily deploy any docker container on the Akash Network.",
    alternates: {
      canonical: url
    },
    openGraph: {
      url
    }
  };
}
export default function TemplateGalleryPage() {
  return <TemplateGallery />;
}
