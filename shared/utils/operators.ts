export type QueryOperator = "eq" | "neq" | "lt" | "ltq" | "gt" | "gtq";

export const mapQueryOperatorToForm = (operator: QueryOperator) => {
  switch (operator) {
    case "eq":
      return "=";
    case "neq":
      return "!=";
    case "lt":
      return "<";
    case "ltq":
      return "<=";
    case "gt":
      return ">";
    case "gtq":
      return ">=";

    default:
      return "=";
  }
};
