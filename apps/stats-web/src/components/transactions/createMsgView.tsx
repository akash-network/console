import { DynamicReactJson } from "../DynamicJsonView";

import type { TransactionMessage } from "@/types";

export function createMsgView<T extends { message: TransactionMessage; version: string }>(supportedVersions: string[], Component: React.FunctionComponent<T>) {
  return (props: T) => {
    if (supportedVersions.includes(props.version)) {
      return <Component {...props} />;
    }

    return <DynamicReactJson src={JSON.parse(JSON.stringify(props))} />;
  };
}
