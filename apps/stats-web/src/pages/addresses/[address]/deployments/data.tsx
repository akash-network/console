export const statuses = [
  {
    value: "*",
    label: "All"
  },
  {
    value: "active",
    label: "Active"
  },
  {
    value: "closed",
    label: "Closed"
  }
];

export function getStatusColor(status: string): "default" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    default:
      return "destructive";
  }
}
