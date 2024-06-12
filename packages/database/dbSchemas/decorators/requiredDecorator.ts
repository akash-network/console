import { AllowNull } from "sequelize-typescript";

export function Required(target: any, propertyName: string): void {
  return AllowNull(false)(target, propertyName);
}
