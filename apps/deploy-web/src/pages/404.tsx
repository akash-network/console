/* v8 ignore start */

import type { GetStaticProps } from "next";

import { NOT_FOUND_SEO, NotFoundPage } from "@src/components/shared/NotFoundPage/NotFoundPage";
import { definePublicPage } from "@src/lib/pages/definePublicPage";

export default definePublicPage(NotFoundPage);

export const getStaticProps: GetStaticProps = () => ({ props: { seo: NOT_FOUND_SEO } });
