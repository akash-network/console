export const useFriendlyMessageType = (type: string) => {
  if (!type) return "";

  const splittedType = type.split(".");
  const msgType = splittedType[splittedType.length - 1];
  const friendlyMessageType = msgType
    .substring(3) // Remove "Msg"
    .split(/(?=[A-Z])/)
    .join(" ");

  return friendlyMessageType;
};
