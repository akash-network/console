export function stringToBoolean(str = "") {
  switch (str.toLowerCase()) {
    case "false":
    case "no":
    case "0":
    case "":
      return false;
    default:
      return true;
  }
}

export function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export function isUrl(val) {
  let url;

  try {
    url = new URL(val);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

export function selectText(node) {
  if ((document.body as any).createTextRange) {
    const range = (document.body as any).createTextRange();
    range.moveToElementText(node);
    range.select();
  } else if (window.getSelection) {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    console.warn("Could not select text in node: Unsupported browser.");
  }
}

export const getShortText = (text: string, length: number) => {
  return text.length < length ? text : `${text.substring(0, length - 3)}...`;
};