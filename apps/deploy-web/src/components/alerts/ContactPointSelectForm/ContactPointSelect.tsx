import type { FC } from "react";
import { useCallback, useState } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { buttonVariants, FormField, FormLabel, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus } from "iconoir-react";
import Link from "next/link";

import type { ContactPointsOutput } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";

export const ContactPointSelect: FC = () => {
  const { control, setValue } = useFormContext();
  const [isInit, setIsInit] = useState(false);

  const initWithFirstValue = useCallback(
    (data: ContactPointsOutput) => {
      if (!isInit) {
        setIsInit(true);
        setValue("contactPointId", data[0]?.id);
      }
    },
    [isInit, setValue]
  );

  return (
    <ContactPointsListContainer onFetched={initWithFirstValue}>
      {({ data, isFetched }) => (
        <LoadingBlocker isLoading={!isFetched}>
          <FormLabel htmlFor="contact-point-id">Contact Point</FormLabel>
          <div className="flex">
            <FormField
              control={control}
              name="contactPointId"
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <SelectTrigger id="contact-point-id">
                    <SelectValue placeholder="Select contact point" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {data.map(contactPoint => (
                        <SelectItem key={contactPoint.id} value={contactPoint.id}>
                          {contactPoint.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            />
            <div className="ml-2">
              <Link href="/alerts/contact-points/new" className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
                <Plus />
              </Link>
            </div>
          </div>
        </LoadingBlocker>
      )}
    </ContactPointsListContainer>
  );
};
