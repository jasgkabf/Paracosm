import { Logger } from "@paracosm/shared";

const logger = new Logger("TemplateEngine");

export interface TemplateContext {
  [key: string]: unknown;
}

export class TemplateEngine {
  private cache: Map<string, (context: TemplateContext) => string> = new Map();

  compile(template: string): (context: TemplateContext) => string {
    const cached = this.cache.get(template);
    if (cached) {
      return cached;
    }

    const compiled = this.buildRenderer(template);
    this.cache.set(template, compiled);
    return compiled;
  }

  render(template: string, context: TemplateContext): string {
    const renderer = this.compile(template);
    return renderer(context);
  }

  renderVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, value);
    }
    return result;
  }

  renderConditional(template: string, conditions: Record<string, boolean>): string {
    let result = template;
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(conditionalRegex, (_match, conditionName, content) => {
      if (conditions[conditionName]) {
        return content;
      }
      return "";
    });

    const elseRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/if\}\}/g;
    result = result.replace(elseRegex, (_match, conditionName, trueContent, falseContent) => {
      return conditions[conditionName] ? trueContent : falseContent;
    });

    return result;
  }

  renderLoops(template: string, arrays: Record<string, unknown[]>): string {
    let result = template;
    const loopRegex = /\{\{#each\s+(\w+)\s+as\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g;

    result = result.replace(loopRegex, (_match, arrayName, itemName, body) => {
      const array = arrays[arrayName];
      if (!Array.isArray(array)) {
        return "";
      }
      return array.map((item) => {
        let itemBody = body;
        if (typeof item === "object" && item !== null) {
          for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
            itemBody = itemBody.replace(new RegExp(`\\{\\{${itemName}\\.${key}\\}\\}`, "g"), String(value));
          }
        }
        itemBody = itemBody.replace(new RegExp(`\\{\\{${itemName}\\}\\}`, "g"), String(item));
        return itemBody;
      }).join("");
    });

    return result;
  }

  private buildRenderer(template: string): (context: TemplateContext) => string {
    const parts: ((ctx: TemplateContext) => string)[] = [];
    let remaining = template;
    let idx = 0;

    while (remaining.length > 0) {
      const startIdx = remaining.indexOf("{{");
      if (startIdx === -1) {
        const text = remaining;
        parts.push(() => text);
        break;
      }

      if (startIdx > 0) {
        const text = remaining.substring(0, startIdx);
        parts.push(() => text);
      }

      const endIdx = remaining.indexOf("}}", startIdx);
      if (endIdx === -1) {
        const text = remaining.substring(startIdx);
        parts.push(() => text);
        break;
      }

      const expression = remaining.substring(startIdx + 2, endIdx).trim();
      const partIndex = parts.length;
      parts.push(this.buildExpressionRenderer(expression, partIndex));
      remaining = remaining.substring(endIdx + 2);
    }

    return (context: TemplateContext) => {
      return parts.map((part) => part(context)).join("");
    };
  }

  private buildExpressionRenderer(expression: string, _index: number): (ctx: TemplateContext) => string {
    const builtinFunctions: Record<string, (args: unknown[]) => string> = {
      upper: (args) => String(args[0] ?? "").toUpperCase(),
      lower: (args) => String(args[0] ?? "").toLowerCase(),
      trim: (args) => String(args[0] ?? "").trim(),
      default: (args) => args[0] !== undefined && args[0] !== null ? String(args[0]) : String(args[1] ?? ""),
      length: (args) => String(Array.isArray(args[0]) ? args[0].length : String(args[0] ?? "").length),
      join: (args) => Array.isArray(args[0]) ? args[0].join(String(args[1] ?? ",")) : String(args[0] ?? ""),
      json: (args) => JSON.stringify(args[0]),
      slice: (args) => {
        const arr = args[0];
        const start = Number(args[1] ?? 0);
        const end = args[2] !== undefined ? Number(args[2]) : undefined;
        if (typeof arr === "string") return arr.slice(start, end);
        if (Array.isArray(arr)) return arr.slice(start, end).join(", ");
        return String(arr);
      },
    };

    const funcMatch = expression.match(/^(\w+)\((.+)\)$/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const argsStr = funcMatch[2];
      const func = builtinFunctions[funcName];

      if (func) {
        return (ctx: TemplateContext) => {
          const args = argsStr.split(",").map((arg) => {
            const trimmed = arg.trim();
            return this.resolveValue(trimmed, ctx);
          });
          return func(args);
        };
      }
    }

    return (ctx: TemplateContext) => {
      const value = this.resolveValue(expression, ctx);
      return value !== undefined && value !== null ? String(value) : "";
    };
  }

  private resolveValue(path: string, context: TemplateContext): unknown {
    if (path.startsWith('"') && path.endsWith('"')) {
      return path.slice(1, -1);
    }
    if (path.startsWith("'") && path.endsWith("'")) {
      return path.slice(1, -1);
    }
    if (path === "true") return true;
    if (path === "false") return false;
    if (/^-?\d+$/.test(path)) return parseInt(path, 10);
    if (/^-?\d+\.\d+$/.test(path)) return parseFloat(path);

    const parts = path.split(".");
    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }
}
