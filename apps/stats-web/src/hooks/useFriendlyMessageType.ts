export const useFriendlyMessageType = (type: string) => {
  if (!type) return "";

  const splittedType = type.split(".");
  const messageType = splittedType[splittedType.length - 1].replace(/^(Msg|Event)/, "");
  return messageType.split(/(?=[A-Z])/).join(" ");
};
