"use client";

import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { AccountEmailContactPointCreator } from "@src/components/alerts/AccountEmailContactPointCreator/AccountEmailContactPointCreator";
import type { ChildrenProps } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import type { FCWithChildren } from "@src/types/component";
import { UrlService } from "@src/utils/urlUtils";

export const COMPONENTS = {
  AccountEmailContactPointCreator
};

export type Props = Pick<ChildrenProps, "data" | "isFetched"> & { components?: typeof COMPONENTS };

export const ContactPointsGuardView: FCWithChildren<Props> = ({ data, isFetched, children, components: c = COMPONENTS }) => {
  return (
    <LoadingBlocker isLoading={!isFetched} testId="loading-blocker">
      {isFetched && data.length ? (
        children
      ) : (
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="mb-4">To start using alerting you need to add at least one contact point</div>
          <div className="flex gap-4">
            <Link href={UrlService.newContactPoint()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
              <span>Add contact point</span>
            </Link>
            <c.AccountEmailContactPointCreator />
          </div>
        </div>
      )}
    </LoadingBlocker>
  );
};

export const ContactPointsGuard: FCWithChildren = ({ children }) => {
  return (
    <ContactPointsListContainer>
      {contactPointList => (
        <ContactPointsGuardView data={contactPointList.data} isFetched={contactPointList.isFetched}>
          {children}
        </ContactPointsGuardView>
      )}
    </ContactPointsListContainer>
  );
};
