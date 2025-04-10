import { Injectable } from '@nestjs/common';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { interpret } from '@ucast/js';

import { Conditions } from '@src/alert/repositories/raw-alert/raw-alert.repository';

@Injectable()
export class ConditionsMatcherService {
  constructor() {}

  isMatching(conditions: Conditions, data: Record<string, any>): boolean {
    const condition = this.toConditions(conditions);
    return interpret(condition, data);
  }

  private toConditions(ast: Conditions): CompoundCondition | FieldCondition {
    if (['and', 'or'].includes(ast.operator)) {
      return new CompoundCondition(
        ast.operator,
        ast.value.map(this.toConditions.bind(this)),
      );
    }

    return new FieldCondition(ast.operator, ast.field, ast.value);
  }
}

