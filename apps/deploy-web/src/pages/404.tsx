import Layout from "../components/layout/Layout";
import { ReactNode } from "react";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { buttonVariants } from "@src/components/ui/button";
import { cn } from "@src/utils/styleUtils";
import { ArrowLeft } from "iconoir-react";

type Props = {
  children?: ReactNode;
};

const FourOhFour: React.FunctionComponent<Props> = ({}) => {
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
