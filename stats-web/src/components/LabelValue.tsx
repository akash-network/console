import { cn } from "@/lib/utils";

type LabelValueProps = {
  label: any;
  value?: any;
  labelWidth?: string | number;
  className?: string;

  // All other props
  [x: string]: any;
};

export const LabelValue: React.FunctionComponent<LabelValueProps> = ({ label, value, labelWidth = "15rem", className = "", ...rest }) => {
  return (
    <div className={cn(className, "mb-4 flex flex-col items-start last:mb-0 sm:flex-row sm:items-center")} {...rest}>
      <div className="flex shrink-0 items-center break-all pr-2 font-bold text-muted-foreground" style={{ width: labelWidth }}>
        {label}
      </div>
      {!!value && <div className="w-full flex-grow break-all [overflow-wrap:anywhere] sm:w-auto">{value}</div>}
    </div>
  );
};
