import { Injectable } from '@nestjs/common';
import { CompoundCondition, FieldCondition } from '@ucast/core';
import { interpret } from '@ucast/js';

export type BaseCondition = {
  operator: string;
  field: string;
  value: any;
};

export type CompoundConditionNode = {
  operator: 'and' | 'or';
  value: Conditions[];
};

export type Conditions = BaseCondition | CompoundConditionNode;

@Injectable()
export class ConditionsMatcherService {
  constructor() {}

  isMatching(conditions: Conditions, data: Record<string, any>): boolean {
    const condition = this.toConditions(conditions);
    return interpret(condition, data);
  }

  private toConditions(ast: Conditions): CompoundCondition | FieldCondition {
    if (ast.operator === 'and' || ast.operator === 'or') {
      return new CompoundCondition(
        ast.operator,
        ast.value.map(this.toConditions.bind(this)),
      );
    }

    if ('field' in ast && 'value' in ast) {
      return new FieldCondition(ast.operator, ast.field, ast.value);
    }

    throw new Error('Invalid condition structure');
  }
}
