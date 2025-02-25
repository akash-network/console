import { useMemo } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";

import { getSplitText, SPLIT_TEXT_GLUE } from "@src/hooks/useShortText";

interface Props {
  value: string;
  maxLength: number;
  headLength?: number;
}

export const ShortenedValue: React.FunctionComponent<Props> = ({ value, maxLength, headLength }) => {
  const defaultHeadLength = useMemo(() => {
    return Math.floor((maxLength - SPLIT_TEXT_GLUE.length) / 2);
  }, [maxLength]);

  const tailLength = useMemo(() => {
    return maxLength - (headLength ?? defaultHeadLength) - SPLIT_TEXT_GLUE.length;
  }, [defaultHeadLength, headLength, maxLength]);

  return value.length > maxLength ? (
    <CustomTooltip title={value}>
      <span>{getSplitText(value, (headLength ?? defaultHeadLength), tailLength)}</span>
    </CustomTooltip>
  ) : (
    <>{value}</>
  );
};
