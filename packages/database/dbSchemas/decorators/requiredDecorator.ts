import { AllowNull } from "sequelize-typescript";

export function Required(target: object, propertyName: string): void {
  return AllowNull(false)(target, propertyName);
}
