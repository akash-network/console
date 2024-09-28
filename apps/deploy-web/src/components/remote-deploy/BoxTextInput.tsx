import React from "react";
import { Input } from "@akashnetwork/ui/components";
const BoxTextInput = ({
  label,
  description,
  placeholder,
  onChange
}: {
  label: string;
  description?: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">{label}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Input onChange={onChange} placeholder={placeholder} />
    </div>
  );
};

export default BoxTextInput;
