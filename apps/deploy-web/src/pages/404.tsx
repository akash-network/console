import React from "react";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { Title } from "@src/components/shared/Title";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../components/layout/Layout";

const FourOhFour: React.FunctionComponent = () => {
  return (
    <Layout>
      <NextSeo title="Page not found" />

      <div className="mt-10 text-center">
        <Title className="mb-2">404</Title>
        <h3 className="text-2xl">Page not found.</h3>

        <div className="pt-6">
          <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
            <ArrowLeft className="mr-4" />
            Go to homepage
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default FourOhFour;
