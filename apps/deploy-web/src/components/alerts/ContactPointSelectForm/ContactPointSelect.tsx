import type { FC } from "react";
import { useCallback, useState } from "react";
import React from "react";
import { useFormContext } from "react-hook-form";
import { Button, FormField, FormLabel, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";

import { ContactPointCreateContainer } from "@src/components/alerts/ContactPointCreateContainer/ContactPointCreateContainer";
import type { ContactPointsOutput } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useUser } from "@src/hooks/useUser";

export const ContactPointSelect: FC = () => {
  const { control, setValue } = useFormContext();
  const { email } = useUser();
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
          {data.length ? (
            <>
              <FormLabel htmlFor="contact-point-id">Contact Point</FormLabel>
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
            </>
          ) : (
            <ContactPointCreateContainer
              onCreate={contactPoint => {
                setValue("contactPointId", contactPoint.id);
              }}
            >
              {props => <Button onClick={() => props.create({ name: "Primary account email", emails: [email as string] })}>Use my account email</Button>}
            </ContactPointCreateContainer>
          )}
        </LoadingBlocker>
      )}
    </ContactPointsListContainer>
  );
};
