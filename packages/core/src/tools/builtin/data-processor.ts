import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";

export interface AggregationResult {
  groups: Array<{ key: string; value: number; count: number }>;
  total: number;
  average: number;
  min: number;
  max: number;
}

export interface VisualizationConfig {
  type: "bar" | "line" | "pie" | "scatter" | "histogram" | "table";
  title: string;
  xLabel: string;
  yLabel: string;
  data: Array<Record<string, unknown>>;
  options: Record<string, unknown>;
}

type DataFormat = "json" | "csv" | "tsv" | "xml" | "yaml";

export class DataProcessorTool implements ToolInternal {
  id = "data_processor";
  name = "Data Processor";
  type = ToolType.Transformer;
  description = "Parse, transform, filter, aggregate, visualize, and export data in various formats";
  parameters = [
    { name: "operation", type: "string" as const, description: "Data operation to perform", required: true, defaultValue: null, enum: ["parse", "transform", "filter", "aggregate", "visualize", "export"] },
    { name: "data", type: "object" as const, description: "Input data", required: true, defaultValue: null, enum: null },
    { name: "format", type: "string" as const, description: "Data format for parse/export", required: false, defaultValue: "json", enum: ["json", "csv", "tsv", "xml", "yaml"] },
  ];
  returnType = "unknown";
  returnDescription = "Result depends on the operation performed";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { operation: "parse", data: '{"key":"value"}', format: "json" }, output: { key: "value" }, description: "Parse JSON data" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "data";
  permissionLevel = "safe" as const;
  rateLimitPerMinute = 120;
  maxConcurrentExecutions = 20;
  requiresSandbox = false;

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const operation = String(params.operation ?? "");
      if (!operation) {
        return this.errorResult("Operation is required", startTime);
      }
      switch (operation) {
        case "parse": {
          const format = String(params.format ?? "json") as DataFormat;
          const result = this.parse(params.data, format);
          return this.successResult(result, startTime);
        }
        case "transform": {
          const operations = params.operations as Record<string, unknown>[];
          if (!operations || !Array.isArray(operations)) {
            return this.errorResult("Operations array is required for transform", startTime);
          }
          const result = this.transform(params.data, operations);
          return this.successResult(result, startTime);
        }
        case "filter": {
          const condition = params.condition as Record<string, unknown>;
          if (!condition) {
            return this.errorResult("Condition is required for filter", startTime);
          }
          const result = this.filter(params.data, condition);
          return this.successResult(result, startTime);
        }
        case "aggregate": {
          const groupBy = String(params.groupBy ?? "");
          const metric = String(params.metric ?? "count");
          if (!groupBy) {
            return this.errorResult("groupBy field is required for aggregate", startTime);
          }
          const result = this.aggregate(params.data, groupBy, metric);
          return this.successResult(result, startTime);
        }
        case "visualize": {
          const chartType = (params.chartType as VisualizationConfig["type"]) ?? "bar";
          const result = this.visualize(params.data, chartType);
          return this.successResult(result, startTime);
        }
        case "export": {
          const format = String(params.format ?? "json") as DataFormat;
          const result = this.export(params.data, format);
          return this.successResult(result, startTime);
        }
        default:
          return this.errorResult(`Unknown operation: ${operation}`, startTime);
      }
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.operation || typeof params.operation !== "string") return false;
    const validOps = ["parse", "transform", "filter", "aggregate", "visualize", "export"];
    if (!validOps.includes(params.operation as string)) return false;
    if (params.data === undefined || params.data === null) return false;
    return true;
  }

  parse(data: unknown, format: DataFormat): unknown {
    if (data === null || data === undefined) {
      throw new Error("Data cannot be null or undefined");
    }
    switch (format) {
      case "json": {
        if (typeof data === "string") {
          return JSON.parse(data);
        }
        return data;
      }
      case "csv": {
        const str = typeof data === "string" ? data : String(data);
        return this.parseCsv(str);
      }
      case "tsv": {
        const str = typeof data === "string" ? data : String(data);
        return this.parseTsv(str);
      }
      case "xml": {
        const str = typeof data === "string" ? data : String(data);
        return this.parseXml(str);
      }
      case "yaml": {
        const str = typeof data === "string" ? data : String(data);
        return this.parseYaml(str);
      }
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  transform(data: unknown, operations: Record<string, unknown>[]): unknown {
    let current = Array.isArray(data) ? [...data] : data;
    for (const op of operations) {
      const opType = String(op.type ?? "");
      switch (opType) {
        case "map": {
          const field = String(op.field ?? "");
          const expression = String(op.expression ?? "");
          if (Array.isArray(current)) {
            current = current.map((item) => {
              if (typeof item === "object" && item !== null) {
                const copy = { ...(item as Record<string, unknown>) };
                copy[field] = this.evaluateExpression(expression, copy);
                return copy;
              }
              return item;
            });
          }
          break;
        }
        case "sort": {
          const sortField = String(op.field ?? "");
          const order = String(op.order ?? "asc");
          if (Array.isArray(current)) {
            current = [...current].sort((a, b) => {
              const aVal = typeof a === "object" && a !== null ? (a as Record<string, unknown>)[sortField] : a;
              const bVal = typeof b === "object" && b !== null ? (b as Record<string, unknown>)[sortField] : b;
              if (aVal === bVal) return 0;
              if (aVal === undefined || aVal === null) return 1;
              if (bVal === undefined || bVal === null) return -1;
              const comparison = aVal < bVal ? -1 : 1;
              return order === "desc" ? -comparison : comparison;
            });
          }
          break;
        }
        case "select": {
          const fields = op.fields as string[];
          if (Array.isArray(current) && fields) {
            current = current.map((item) => {
              if (typeof item === "object" && item !== null) {
                const selected: Record<string, unknown> = {};
                for (const f of fields) {
                  selected[f] = (item as Record<string, unknown>)[f];
                }
                return selected;
              }
              return item;
            });
          }
          break;
        }
        case "rename": {
          const mapping = op.mapping as Record<string, string>;
          if (Array.isArray(current) && mapping) {
            current = current.map((item) => {
              if (typeof item === "object" && item !== null) {
                const renamed: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
                  const newKey = mapping[key] ?? key;
                  renamed[newKey] = value;
                }
                return renamed;
              }
              return item;
            });
          }
          break;
        }
        case "flatten": {
          if (Array.isArray(current)) {
            current = current.flat(Infinity);
          }
          break;
        }
        case "unique": {
          if (Array.isArray(current)) {
            const seen = new Set<string>();
            current = current.filter((item) => {
              const key = JSON.stringify(item);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }
          break;
        }
        case "limit": {
          const count = Number(op.count ?? 10);
          if (Array.isArray(current)) {
            current = current.slice(0, count);
          }
          break;
        }
      }
    }
    return current;
  }

  filter(data: unknown, condition: Record<string, unknown>): unknown[] {
    const arr = Array.isArray(data) ? data : [data];
    const field = String(condition.field ?? "");
    const operator = String(condition.operator ?? "eq");
    const value = condition.value;
    return arr.filter((item) => {
      if (typeof item !== "object" || item === null) return false;
      const itemValue = (item as Record<string, unknown>)[field];
      switch (operator) {
        case "eq":
          return itemValue === value;
        case "neq":
          return itemValue !== value;
        case "gt":
          return typeof itemValue === "number" && typeof value === "number" && itemValue > value;
        case "gte":
          return typeof itemValue === "number" && typeof value === "number" && itemValue >= value;
        case "lt":
          return typeof itemValue === "number" && typeof value === "number" && itemValue < value;
        case "lte":
          return typeof itemValue === "number" && typeof value === "number" && itemValue <= value;
        case "contains":
          return typeof itemValue === "string" && typeof value === "string" && itemValue.includes(value);
        case "starts_with":
          return typeof itemValue === "string" && typeof value === "string" && itemValue.startsWith(value);
        case "ends_with":
          return typeof itemValue === "string" && typeof value === "string" && itemValue.endsWith(value);
        case "in":
          return Array.isArray(value) && value.includes(itemValue);
        case "not_null":
          return itemValue !== null && itemValue !== undefined;
        default:
          return true;
      }
    });
  }

  aggregate(data: unknown, groupBy: string, metric: string): AggregationResult {
    const arr = Array.isArray(data) ? data : [data];
    const groups = new Map<string, { values: number[]; count: number }>();
    for (const item of arr) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const key = String(record[groupBy] ?? "null");
      if (!groups.has(key)) {
        groups.set(key, { values: [], count: 0 });
      }
      const group = groups.get(key)!;
      group.count++;
      const numericFields = Object.values(record).filter((v) => typeof v === "number");
      for (const v of numericFields) {
        group.values.push(v as number);
      }
    }
    const result: AggregationResult = {
      groups: [],
      total: 0,
      average: 0,
      min: Infinity,
      max: -Infinity,
    };
    let allValues: number[] = [];
    for (const [key, group] of groups.entries()) {
      let value: number;
      switch (metric) {
        case "count":
          value = group.count;
          break;
        case "sum":
          value = group.values.reduce((a, b) => a + b, 0);
          break;
        case "avg":
          value = group.values.length > 0 ? group.values.reduce((a, b) => a + b, 0) / group.values.length : 0;
          break;
        case "min":
          value = group.values.length > 0 ? Math.min(...group.values) : 0;
          break;
        case "max":
          value = group.values.length > 0 ? Math.max(...group.values) : 0;
          break;
        default:
          value = group.count;
      }
      result.groups.push({ key, value, count: group.count });
      allValues = allValues.concat(group.values);
    }
    result.total = allValues.reduce((a, b) => a + b, 0);
    result.average = allValues.length > 0 ? result.total / allValues.length : 0;
    result.min = allValues.length > 0 ? Math.min(...allValues) : 0;
    result.max = allValues.length > 0 ? Math.max(...allValues) : 0;
    return result;
  }

  visualize(data: unknown, chartType: VisualizationConfig["type"]): VisualizationConfig {
    const arr = Array.isArray(data) ? data : [data];
    const config: VisualizationConfig = {
      type: chartType,
      title: "Data Visualization",
      xLabel: "X",
      yLabel: "Y",
      data: arr.map((item) =>
        typeof item === "object" && item !== null
          ? (item as Record<string, unknown>)
          : { value: item }
      ),
      options: {
        width: 800,
        height: 400,
        colors: ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#FF6D01"],
      },
    };
    if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
      const keys = Object.keys(arr[0] as Record<string, unknown>);
      if (keys.length >= 2) {
        config.xLabel = keys[0];
        config.yLabel = keys[1];
      }
    }
    return config;
  }

  export(data: unknown, format: DataFormat): Buffer {
    switch (format) {
      case "json": {
        const jsonStr = JSON.stringify(data, null, 2);
        return Buffer.from(jsonStr, "utf-8");
      }
      case "csv": {
        const csvStr = this.toCsv(data);
        return Buffer.from(csvStr, "utf-8");
      }
      case "tsv": {
        const tsvStr = this.toTsv(data);
        return Buffer.from(tsvStr, "utf-8");
      }
      case "xml": {
        const xmlStr = this.toXml(data);
        return Buffer.from(xmlStr, "utf-8");
      }
      case "yaml": {
        const yamlStr = this.toYaml(data);
        return Buffer.from(yamlStr, "utf-8");
      }
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private parseCsv(str: string): Record<string, unknown>[] {
    const lines = str.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const results: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.splitCsvLine(lines[i]);
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const raw = values[j]?.trim().replace(/^"|"$/g, "") ?? "";
        record[headers[j]] = this.inferType(raw);
      }
      results.push(record);
    }
    return results;
  }

  private parseTsv(str: string): Record<string, unknown>[] {
    const lines = str.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split("\t").map((h) => h.trim());
    const results: Record<string, unknown>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split("\t");
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = this.inferType(values[j]?.trim() ?? "");
      }
      results.push(record);
    }
    return results;
  }

  private parseXml(str: string): unknown {
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    const result: Record<string, unknown> = {};
    let match;
    while ((match = tagRegex.exec(str)) !== null) {
      const [, tag, content] = match;
      const innerContent = content.trim();
      if (/<\w+>/.test(innerContent)) {
        result[tag] = this.parseXml(innerContent);
      } else {
        result[tag] = this.inferType(innerContent);
      }
    }
    return result;
  }

  private parseYaml(str: string): unknown {
    const lines = str.split("\n");
    const result: Record<string, unknown> = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const colonIndex = trimmed.indexOf(":");
      if (colonIndex === -1) continue;
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      if (value) {
        result[key] = this.inferType(value);
      }
    }
    return result;
  }

  private inferType(value: string): unknown {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value === "undefined") return undefined;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private toCsv(data: unknown): string {
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return "";
    const allKeys = new Set<string>();
    for (const item of arr) {
      if (typeof item === "object" && item !== null) {
        for (const key of Object.keys(item as Record<string, unknown>)) {
          allKeys.add(key);
        }
      }
    }
    const headers = Array.from(allKeys);
    const lines: string[] = [headers.join(",")];
    for (const item of arr) {
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        const values = headers.map((h) => {
          const val = record[h];
          const str = val === null || val === undefined ? "" : String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        });
        lines.push(values.join(","));
      }
    }
    return lines.join("\n");
  }

  private toTsv(data: unknown): string {
    const arr = Array.isArray(data) ? data : [data];
    if (arr.length === 0) return "";
    const allKeys = new Set<string>();
    for (const item of arr) {
      if (typeof item === "object" && item !== null) {
        for (const key of Object.keys(item as Record<string, unknown>)) {
          allKeys.add(key);
        }
      }
    }
    const headers = Array.from(allKeys);
    const lines: string[] = [headers.join("\t")];
    for (const item of arr) {
      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        const values = headers.map((h) => String(record[h] ?? ""));
        lines.push(values.join("\t"));
      }
    }
    return lines.join("\n");
  }

  private toXml(data: unknown, rootTag: string = "root"): string {
    if (Array.isArray(data)) {
      const items = data.map((item) => `  <item>${this.toXmlFragment(item)}</item>`).join("\n");
      return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${items}\n</${rootTag}>`;
    }
    if (typeof data === "object" && data !== null) {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${this.toXmlFragment(data)}\n</${rootTag}>`;
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>${String(data)}</${rootTag}>`;
  }

  private toXmlFragment(data: unknown): string {
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      return Object.entries(record)
        .map(([key, value]) => {
          if (value === null || value === undefined) return `<${key}/>`;
          if (typeof value === "object") return `<${key}>${this.toXmlFragment(value)}</${key}>`;
          return `<${key}>${String(value)}</${key}>`;
        })
        .join("\n    ");
    }
    return String(data);
  }

  private toYaml(data: unknown, indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    if (Array.isArray(data)) {
      if (data.length === 0) return prefix + "[]";
      return data
        .map((item) => {
          if (typeof item === "object" && item !== null) {
            const inner = this.toYaml(item, indent + 1);
            const lines = inner.split("\n").filter((l) => l.trim());
            return prefix + "- " + lines[0].trim() + (lines.length > 1 ? "\n" + lines.slice(1).join("\n") : "");
          }
          return prefix + "- " + String(item);
        })
        .join("\n");
    }
    if (typeof data === "object" && data !== null) {
      const record = data as Record<string, unknown>;
      return Object.entries(record)
        .map(([key, value]) => {
          if (value === null) return `${prefix}${key}: null`;
          if (value === undefined) return `${prefix}${key}: undefined`;
          if (typeof value === "object") {
            return `${prefix}${key}:\n${this.toYaml(value, indent + 1)}`;
          }
          if (typeof value === "string") {
            return value.includes("\n") || value.includes(":") || value.includes("#")
              ? `${prefix}${key}: "${value.replace(/"/g, '\\"')}"`
              : `${prefix}${key}: ${value}`;
          }
          return `${prefix}${key}: ${String(value)}`;
        })
        .join("\n");
    }
    return prefix + String(data);
  }

  private evaluateExpression(expression: string, context: Record<string, unknown>): unknown {
    try {
      if (expression.startsWith("$.")) {
        const path = expression.slice(2);
        const parts = path.split(".");
        let value: unknown = context;
        for (const part of parts) {
          if (value && typeof value === "object") {
            value = (value as Record<string, unknown>)[part];
          } else {
            return undefined;
          }
        }
        return value;
      }
      if (expression.startsWith("toUpperCase(")) {
        const arg = expression.slice(12, -1);
        const val = this.evaluateExpression(arg, context);
        return typeof val === "string" ? val.toUpperCase() : val;
      }
      if (expression.startsWith("toLowerCase(")) {
        const arg = expression.slice(12, -1);
        const val = this.evaluateExpression(arg, context);
        return typeof val === "string" ? val.toLowerCase() : val;
      }
      if (expression.startsWith("Number(")) {
        const arg = expression.slice(7, -1);
        const val = this.evaluateExpression(arg, context);
        return Number(val);
      }
      if (expression.startsWith("String(")) {
        const arg = expression.slice(7, -1);
        const val = this.evaluateExpression(arg, context);
        return String(val);
      }
      return expression;
    } catch {
      return expression;
    }
  }

  private successResult(data: unknown, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: true,
      data,
      error: null,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private errorResult(error: string, startTime: number): ToolExecutionResult {
    return {
      executionId: generateId(),
      toolId: this.id,
      success: false,
      data: null,
      error,
      executionTimeMs: Date.now() - startTime,
      memoryUsedBytes: 0,
      cpuTimeMs: Date.now() - startTime,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
