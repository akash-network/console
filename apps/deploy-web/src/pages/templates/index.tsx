import type { FC } from "react";

import type { TemplateGalleryRouteProps } from "@src/components/templates/loadTemplateGalleryRouteProps";
import { loadTemplateGalleryRouteProps } from "@src/components/templates/loadTemplateGalleryRouteProps";
import { TemplateGallery } from "@src/components/templates/TemplateGallery";
import { defineServerSideProps } from "@src/lib/nextjs/defineServerSideProps/defineServerSideProps";

const TemplateGalleryPage: FC<TemplateGalleryRouteProps> = ({ firstPage }) => <TemplateGallery firstPage={firstPage} />;

export default TemplateGalleryPage;

export const getServerSideProps = defineServerSideProps({
  route: "/templates",
  public: true,
  handler: loadTemplateGalleryRouteProps
});
