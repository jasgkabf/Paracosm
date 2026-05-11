import chalk from "chalk";

type OutputFormat = "json" | "table" | "yaml" | "text";

interface FormatOptions {
  format?: OutputFormat;
  colorize?: boolean;
  paginate?: boolean;
  pageSize?: number;
}

interface TableColumn {
  key: string;
  header: string;
  width?: number;
}

function autoDetectColumns(data: Array<Record<string, unknown>>): TableColumn[] {
  if (data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => ({
    key,
    header: key.charAt(0).toUpperCase() + key.slice(1),
    width: Math.max(
      key.length + 2,
      Math.min(
        30,
        Math.max(...data.map((row) => String(row[key] ?? "").length)) + 2
      )
    ),
  }));
}

function formatAsJson(data: unknown, useColor: boolean): string {
  const json = JSON.stringify(data, null, 2);
  if (!useColor) return json;

  return json.replace(
    /("(?:\\.|[^"\\])*")\s*:/g,
    (_, key) => chalk.cyan(key) + ":"
  ).replace(
    /:\s*("(?:\\.|[^"\\])*")/g,
    (_, value) => ": " + chalk.green(value)
  ).replace(
    /:\s*(\d+\.?\d*)/g,
    (_, num) => ": " + chalk.yellow(num)
  ).replace(
    /:\s*(true|false)/g,
    (_, bool) => ": " + chalk.magenta(bool)
  ).replace(
    /:\s*(null)/g,
    (_, nul) => ": " + chalk.gray(nul)
  );
}

function formatAsTable(
  data: Array<Record<string, unknown>>,
  columns: TableColumn[],
  useColor: boolean
): string {
  if (data.length === 0) return useColor ? chalk.gray("No data") : "No data";

  const cols = columns.length > 0 ? columns : autoDetectColumns(data);
  const lines: string[] = [];

  const headerParts = cols.map((col) => {
    const header = col.header ?? col.key;
    const width = col.width ?? header.length + 2;
    return padString(header, width);
  });
  const headerLine = headerParts.join(" | ");
  lines.push(useColor ? chalk.cyan.bold(headerLine) : headerLine);

  const separatorParts = cols.map((col) => {
    const width = col.width ?? (col.header ?? col.key).length + 2;
    return "-".repeat(width);
  });
  lines.push(separatorParts.join("-+-"));

  for (const row of data) {
    const rowParts = cols.map((col) => {
      const value = String(row[col.key] ?? "");
      const width = col.width ?? (col.header ?? col.key).length + 2;
      return padString(value, width);
    });
    lines.push(rowParts.join(" | "));
  }

  return lines.join("\n");
}

function formatAsYaml(data: unknown, indent: number = 0, useColor: boolean): string {
  const prefix = "  ".repeat(indent);

  if (data === null || data === undefined) {
    return useColor ? chalk.gray("null") : "null";
  }
  if (typeof data === "boolean") {
    const val = data ? "true" : "false";
    return useColor ? chalk.magenta(val) : val;
  }
  if (typeof data === "number") {
    return useColor ? chalk.yellow(String(data)) : String(data);
  }
  if (typeof data === "string") {
    if (data.includes("\n") || data.includes(":") || data.includes("#")) {
      const escaped = `"${data.replace(/"/g, '\\"')}"`;
      return useColor ? chalk.green(escaped) : escaped;
    }
    return useColor ? chalk.green(data) : data;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data
      .map((item) => {
        const val = formatAsYaml(item, indent + 1, useColor);
        if (typeof item === "object" && item !== null && !Array.isArray(item)) {
          return `${prefix}- ${val.trimStart()}`;
        }
        return `${prefix}- ${val}`;
      })
      .join("\n");
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return entries
    .map(([key, value]) => {
      const keyStr = useColor ? chalk.cyan(key) : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const nested = formatAsYaml(value, indent + 1, useColor);
        return `${prefix}${keyStr}:\n${nested}`;
      }
      const val = formatAsYaml(value, 0, useColor);
      return `${prefix}${keyStr}: ${val}`;
    })
    .join("\n");
}

function formatAsText(data: unknown, useColor: boolean): string {
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);
  if (Array.isArray(data)) {
    if (data.length === 0) return useColor ? chalk.gray("(empty)") : "(empty)";
    if (data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
      return formatAsTable(data as Array<Record<string, unknown>>, [], useColor);
    }
    return data.map((item) => `  - ${String(item)}`).join("\n");
  }
  if (typeof data === "object" && data !== null) {
    return Object.entries(data as Record<string, unknown>)
      .map(([key, value]) => {
        const keyStr = useColor ? chalk.cyan(key) : key;
        return `${keyStr}: ${formatAsYaml(value, 0, useColor)}`;
      })
      .join("\n");
  }
  return String(data);
}

function padString(str: string, width: number): string {
  if (str.length >= width) return str.slice(0, width - 1) + ".";
  return str + " ".repeat(width - str.length);
}

export function formatOutput(
  data: unknown,
  options: FormatOptions = {}
): void {
  const format = options.format ?? "text";
  const useColor = options.colorize ?? true;

  let output: string;

  switch (format) {
    case "json":
      output = formatAsJson(data, useColor);
      break;
    case "table":
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
        output = formatAsTable(data as Array<Record<string, unknown>>, [], useColor);
      } else {
        output = formatAsJson(data, useColor);
      }
      break;
    case "yaml":
      output = formatAsYaml(data, 0, useColor);
      break;
    case "text":
    default:
      output = formatAsText(data, useColor);
      break;
  }

  if (options.paginate && output.split("\n").length > (options.pageSize ?? 40)) {
    const lines = output.split("\n");
    const pageSize = options.pageSize ?? 40;
    let page = 0;
    const totalPages = Math.ceil(lines.length / pageSize);

    while (page < totalPages) {
      const pageLines = lines.slice(page * pageSize, (page + 1) * pageSize);
      console.log(pageLines.join("\n"));
      page++;

      if (page < totalPages) {
        console.log(useColor ? chalk.dim(`--- Page ${page}/${totalPages} ---`) : `--- Page ${page}/${totalPages} ---`);
      }
    }
  } else {
    console.log(output);
  }
}

export function colorize(text: string, color: string): string {
  const chalkColor = color as keyof typeof chalk;
  if (typeof chalk[chalkColor] === "function") {
    return (chalk[chalkColor] as (str: string) => string)(text);
  }
  return text;
}

export function paginate(
  lines: string[],
  pageSize: number = 40
): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += pageSize) {
    pages.push(lines.slice(i, i + pageSize));
  }
  return pages;
}
