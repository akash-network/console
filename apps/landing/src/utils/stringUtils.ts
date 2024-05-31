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