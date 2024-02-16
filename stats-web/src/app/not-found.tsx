import Link from "next/link";
import PageContainer from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { buttonVariants } from "@/components/ui/button";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "iconoir-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found"
};

export default function FourOhFour({}: React.PropsWithChildren<{}>) {
  return (
    <PageContainer>
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
    </PageContainer>
  );
}
