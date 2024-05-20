// TODO Change for deploy tool

export type PlanCode = "COMMUNITY" | "STARTER" | "ADVANCED";
export interface IPlan {
  name: string;
  code: PlanCode;
  summary: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

export const plans: IPlan[] = [
  {
    name: "Community",
    code: "COMMUNITY",
    summary: "Get access to free features!",
    monthlyPrice: 0,
    yearlyPrice: 0
  },
  {
    name: "Starter",
    code: "STARTER",
    summary: "Small plan for a little bit more!",
    monthlyPrice: 9,
    yearlyPrice: 7 * 12
  },
  {
    name: "Advanced",
    code: "ADVANCED",
    summary: "Best for advanced users who need more!",
    monthlyPrice: 39,
    yearlyPrice: 29 * 12
  }
];
