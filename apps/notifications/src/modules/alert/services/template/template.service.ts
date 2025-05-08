import { Injectable } from '@nestjs/common';

const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

@Injectable()
export class TemplateService {
  /**
   * Replaces `{{ key }}` placeholders in a template string with corresponding values from the context.
   * - Only allows simple variable access (`{{ foo }}` or `{{ user.name }}`).
   * - Prevents access to dangerous object paths like `__proto__`, `constructor`, etc.
   * - Ignores expressions or invalid placeholders.
   *
   * @param template - The template string containing placeholders like `{{ key }}`
   * @param context - An object with values to interpolate into the template
   * @returns The interpolated string with placeholders replaced by context values
   */
  interpolate(template: string, context: object): string {
    return template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key: string) => {
      if (!this.isSafeVariableName(key)) {
        return '';
      }

      const parts = key.split('.');

      if (this.hasDangerousKeys(parts)) {
        return '';
      }

      const value = parts.reduce((acc, part) => {
        if (acc && typeof acc === 'object' && part in acc) {
          return acc[part];
        }
        return undefined;
      }, context as any);

      return value !== undefined && value !== null ? String(value) : '';
    });
  }

  private isSafeVariableName(name: string): boolean {
    return /^[\w.]+$/.test(name);
  }

  private hasDangerousKeys(keys: string[]): boolean {
    return keys.some((key) => BLOCKED_KEYS.has(key));
  }
}
