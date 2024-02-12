"use client";
import { ReactNode, useImperativeHandle, forwardRef } from "react";
import { Control, Controller, useFieldArray } from "react-hook-form";
import { SdlBuilderFormValues, Service } from "@src/types";
import { nanoid } from "nanoid";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Bin, InfoCircle } from "iconoir-react";
import { Tooltip, TooltipTrigger } from "../ui/tooltip";
import { TooltipContent } from "@radix-ui/react-tooltip";
import { cn } from "@src/utils/styleUtils";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

type Props = {
  serviceIndex: number;
  exposeIndex: number;
  services: Service[];
  control: Control<SdlBuilderFormValues, any>;
  children?: ReactNode;
};

export type ToRefType = {
  _removeTo: (index: number | number[]) => void;
};

export const ToFormControl = forwardRef<ToRefType, Props>(({ control, serviceIndex, exposeIndex, services }, ref) => {
  const {
    fields: accept,
    remove: removeTo,
    append: appendTo
  } = useFieldArray({
    control,
    name: `services.${serviceIndex}.expose.${exposeIndex}.to`,
    keyName: "id"
  });
  const currentService = services[serviceIndex];
  const otherServices = services.filter(s => currentService?.id !== s.id);

  const onAddTo = () => {
    appendTo({ id: nanoid(), value: "" });
  };

  useImperativeHandle(ref, () => ({
    _removeTo(index: number | number[]) {
      removeTo(index);
    }
  }));

  // const useStyles = makeStyles()(theme => ({
  //   root: {
  //     marginTop: "1rem",
  //     padding: "1rem",
  //     height: "100%",
  //     display: "flex",
  //     flexDirection: "column",
  //     justifyContent: "space-between",
  //     backgroundColor: theme.palette.mode === "dark" ? theme.palette.primary.dark : theme.palette.grey[300]
  //   }
  // }));

  return (
    <Card className="mt-4 flex h-full flex-col justify-between bg-muted p-4">
      <CardContent>
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <p>
                <strong>To</strong>
              </p>

              <Tooltip>
                <TooltipTrigger>
                  <InfoCircle className="ml-4" />
                </TooltipTrigger>
                <TooltipContent>
                  <>
                    List of entities allowed to connect.
                    <br />
                    <br />
                    If the service is marked as global, it will allow connections from outside the datacenter.
                    <br />
                    <br />
                    <a href="https://docs.akash.network/readme/stack-definition-language#services.expose.to" target="_blank" rel="noopener">
                      View official documentation.
                    </a>
                  </>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {accept.map((acc, accIndex) => {
            return (
              <div
                key={acc.id}
                className={cn({ ["mb-2"]: accIndex + 1 !== accept.length })}
                // sx={{ marginBottom: accIndex + 1 === accept.length ? 0 : ".5rem" }}
              >
                <div className="flex">
                  <div className="flex-grow">
                    <Controller
                      control={control}
                      name={`services.${serviceIndex}.expose.${exposeIndex}.to.${accIndex}.value`}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select network" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {otherServices.map(t => {
                                return (
                                  <SelectItem key={t.id} value={t.title}>
                                    {t.title}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="pl-2">
                    <Button onClick={() => removeTo(accIndex)} size="icon">
                      <Bin />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {otherServices.length === 0 && <p className="text-xs text-muted-foreground">There's no other service to expose to.</p>}
        </div>

        <div className="flex items-center">
          <Button variant="default" size="sm" onClick={onAddTo} disabled={otherServices.length === 0}>
            Add To
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
