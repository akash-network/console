import { ArrowLeft } from "lucide-react";

import { Link } from "@/components/Link/Link";
import { PageContainer } from "@/components/PageContainer";
import { Title } from "@/components/Title";
import { UrlService } from "@/lib/urlUtils";

export default function FourOhFour() {
  return (
    <PageContainer>
      <div className="mt-10 text-center">
        <Title className="mb-2">404</Title>
        <h3 className="text-xl">Page not found.</h3>

        <div className="pt-8">
          <Link href={UrlService.home()} className="inline-flex items-center text-2xl">
            <ArrowLeft className="mr-4 h-7 w-7" />
            Go to homepage
          </Link>
        </div>
      </div>
    </PageContainer>
  );
}
