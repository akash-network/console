export const getShortText = (text: string = "", length: number) => {
  return text.length < length ? text : `${text.substring(0, length - 3)}...`;
};

export const getSplitText = (text: string, start: number = 5, end: number = 5) => {
  const splittedText = [text?.slice(0, start), "...", text?.slice(text?.length - end)].join("");

  return splittedText;
};
