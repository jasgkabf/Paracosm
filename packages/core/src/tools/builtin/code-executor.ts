import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  errors: Array<{ testName: string; message: string; stack: string | null }>;
  executionTimeMs: number;
}

export interface LintResult {
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  rule: string;
}

type SupportedLanguage = "javascript" | "typescript" | "python" | "json" | "sql";

const LINT_RULES: Record<string, Array<{ pattern: RegExp; message: string; severity: LintResult["severity"]; rule: string }>> = {
  javascript: [
    { pattern: /var\s/, message: "Use let or const instead of var", severity: "warning", rule: "no-var" },
    { pattern: /console\.(log|warn|error|debug|info)/, message: "Unexpected console statement", severity: "warning", rule: "no-console" },
    { pattern: /==(?!=)/, message: "Expected === instead of ==", severity: "warning", rule: "eqeqeq" },
    { pattern: /!=(?!=)/, message: "Expected !== instead of !=", severity: "warning", rule: "eqeqeq" },
    { pattern: /eval\s*\(/, message: "Eval is a security risk", severity: "error", rule: "no-eval" },
    { pattern: /debugger/, message: "Unexpected debugger statement", severity: "warning", rule: "no-debugger" },
  ],
  typescript: [
    { pattern: /var\s/, message: "Use let or const instead of var", severity: "warning", rule: "no-var" },
    { pattern: /console\.(log|warn|error|debug|info)/, message: "Unexpected console statement", severity: "warning", rule: "no-console" },
    { pattern: /==(?!=)/, message: "Expected === instead of ==", severity: "warning", rule: "eqeqeq" },
    { pattern: /!=(?!=)/, message: "Expected !== instead of !=", severity: "warning", rule: "eqeqeq" },
    { pattern: /eval\s*\(/, message: "Eval is a security risk", severity: "error", rule: "no-eval" },
    { pattern: /:\s*any\b/, message: "Avoid using 'any' type", severity: "warning", rule: "no-explicit-any" },
    { pattern: /@ts-ignore/, message: "Avoid using @ts-ignore", severity: "info", rule: "no-ts-ignore" },
  ],
  python: [
    { pattern: /import\s+\*/, message: "Wildcard imports are discouraged", severity: "warning", rule: "no-wildcard-import" },
    { pattern: /except:/, message: "Bare except clause, specify exception type", severity: "warning", rule: "bare-except" },
    { pattern: /print\s*\(/, message: "Unexpected print statement", severity: "warning", rule: "no-print" },
    { pattern: /exec\s*\(/, message: "Exec is a security risk", severity: "error", rule: "no-exec" },
  ],
};

export class CodeExecutorTool implements ToolInternal {
  id = "code_exec";
  name = "Code Executor";
  type = ToolType.CodeExecutor;
  description = "Execute, evaluate, test, lint, and format code in a sandboxed environment";
  parameters = [
    { name: "code", type: "string" as const, description: "Code to execute", required: true, defaultValue: null, enum: null },
    { name: "language", type: "string" as const, description: "Programming language", required: true, defaultValue: null, enum: ["javascript", "typescript", "python", "json", "sql"] },
    { name: "timeout", type: "number" as const, description: "Execution timeout in milliseconds", required: false, defaultValue: 30000, enum: null },
  ];
  returnType = "ExecutionResult";
  returnDescription = "Execution result with stdout, stderr, and exit code";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    { input: { code: "console.log('hello')", language: "javascript" }, output: { stdout: "hello\n", stderr: "", exitCode: 0 }, description: "Execute a simple JavaScript expression" },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "code";
  permissionLevel = "dangerous" as const;
  rateLimitPerMinute = 20;
  maxConcurrentExecutions = 3;
  requiresSandbox = true;

  private executionTimeout: number = 30000;
  private maxOutputSize: number = 1024 * 1024;

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const code = String(params.code ?? "");
      const language = String(params.language ?? "") as SupportedLanguage;
      const timeout = Number(params.timeout ?? this.executionTimeout);
      if (!code.trim()) {
        return this.errorResult("Code must be a non-empty string", startTime);
      }
      if (!this.isLanguageSupported(language)) {
        return this.errorResult(`Unsupported language: ${language}`, startTime);
      }
      const result = this.executeCode(code, language, timeout);
      return this.successResult(result, startTime);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.code || typeof params.code !== "string" || params.code.trim().length === 0) return false;
    if (!params.language || typeof params.language !== "string") return false;
    if (!this.isLanguageSupported(params.language as SupportedLanguage)) return false;
    if (params.timeout !== undefined && (typeof params.timeout !== "number" || params.timeout < 0)) return false;
    return true;
  }

  executeCode(code: string, language: SupportedLanguage, timeout?: number): ExecutionResult {
    const startTime = Date.now();
    const actualTimeout = timeout ?? this.executionTimeout;
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    let timedOut = false;

    try {
      switch (language) {
        case "javascript":
        case "typescript": {
          const outputLines: string[] = [];
          const errorLines: string[] = [];
          const mockConsole = {
            log: (...args: unknown[]) => outputLines.push(args.map(String).join(" ")),
            warn: (...args: unknown[]) => outputLines.push(args.map(String).join(" ")),
            error: (...args: unknown[]) => errorLines.push(args.map(String).join(" ")),
            info: (...args: unknown[]) => outputLines.push(args.map(String).join(" ")),
            debug: (...args: unknown[]) => outputLines.push(args.map(String).join(" ")),
          };
          try {
            const wrappedCode = language === "typescript"
              ? code.replace(/:\s*(string|number|boolean|any|void|never|unknown|object)\b/g, "")
              : code;
            const fn = new Function("console", wrappedCode);
            fn(mockConsole);
          } catch (execError) {
            exitCode = 1;
            stderr = execError instanceof Error ? execError.message : String(execError);
          }
          stdout = outputLines.join("\n");
          if (errorLines.length > 0) {
            stderr = errorLines.join("\n");
          }
          break;
        }
        case "json": {
          try {
            const parsed = JSON.parse(code);
            stdout = JSON.stringify(parsed, null, 2);
          } catch (parseError) {
            exitCode = 1;
            stderr = parseError instanceof Error ? parseError.message : String(parseError);
          }
          break;
        }
        case "python": {
          stdout = `[Simulated Python execution]\nCode received: ${code.length} characters\nNote: Python execution requires a runtime environment`;
          break;
        }
        case "sql": {
          stdout = `[Simulated SQL execution]\nQuery received: ${code.length} characters\nNote: SQL execution requires a database connection`;
          break;
        }
      }
    } catch (error) {
      exitCode = 1;
      stderr = error instanceof Error ? error.message : String(error);
    }

    const executionTimeMs = Date.now() - startTime;
    if (executionTimeMs > actualTimeout) {
      timedOut = true;
      exitCode = 124;
      stderr = `Execution timed out after ${actualTimeout}ms`;
    }

    if (stdout.length > this.maxOutputSize) {
      stdout = stdout.slice(0, this.maxOutputSize) + "\n... [output truncated]";
    }
    if (stderr.length > this.maxOutputSize) {
      stderr = stderr.slice(0, this.maxOutputSize) + "\n... [output truncated]";
    }

    return { stdout, stderr, exitCode, executionTimeMs, timedOut };
  }

  evaluate(expression: string): unknown {
    if (!expression || typeof expression !== "string") {
      throw new Error("Expression must be a non-empty string");
    }
    try {
      const result = new Function(`return (${expression})`)();
      return result;
    } catch (error) {
      throw new Error(`Evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  test(testCode: string, code: string): TestResult {
    const startTime = Date.now();
    const result: TestResult = {
      passed: 0,
      failed: 0,
      total: 0,
      errors: [],
      executionTimeMs: 0,
    };

    const testCases = this.parseTestCases(testCode);
    result.total = testCases.length;

    for (const testCase of testCases) {
      try {
        const fn = new Function("code", testCase.body);
        fn(code);
        result.passed++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          testName: testCase.name,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error && error.stack ? error.stack : null,
        });
      }
    }

    result.executionTimeMs = Date.now() - startTime;
    return result;
  }

  lint(code: string, language: SupportedLanguage): LintResult[] {
    const results: LintResult[] = [];
    const rules = LINT_RULES[language];
    if (!rules) {
      return results;
    }
    const lines = code.split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      for (const rule of rules) {
        const match = rule.pattern.exec(line);
        if (match) {
          results.push({
            line: lineIndex + 1,
            column: match.index + 1,
            severity: rule.severity,
            message: rule.message,
            rule: rule.rule,
          });
        }
      }
    }
    return results;
  }

  format(code: string, language: SupportedLanguage): string {
    if (!code || typeof code !== "string") {
      return code;
    }
    switch (language) {
      case "json": {
        try {
          return JSON.stringify(JSON.parse(code), null, 2);
        } catch {
          return code;
        }
      }
      case "javascript":
      case "typescript": {
        let formatted = code;
        formatted = formatted.replace(/\t/g, "  ");
        formatted = formatted.replace(/\r\n/g, "\n");
        formatted = formatted.replace(/\n{3,}/g, "\n\n");
        const lines = formatted.split("\n");
        const formattedLines: string[] = [];
        let indentLevel = 0;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            formattedLines.push("");
            continue;
          }
          if (trimmed.startsWith("}") || trimmed.startsWith("]") || trimmed.startsWith(")")) {
            indentLevel = Math.max(0, indentLevel - 1);
          }
          formattedLines.push("  ".repeat(indentLevel) + trimmed);
          const openCount = (trimmed.match(/[{(\[]/g) || []).length;
          const closeCount = (trimmed.match(/[})\]]/g) || []).length;
          indentLevel += openCount - closeCount;
          if (trimmed.endsWith("{") || trimmed.endsWith("[") || trimmed.endsWith("(")) {
            indentLevel = Math.max(indentLevel, indentLevel);
          }
        }
        return formattedLines.join("\n");
      }
      case "python": {
        let formatted = code;
        formatted = formatted.replace(/\t/g, "    ");
        formatted = formatted.replace(/\r\n/g, "\n");
        formatted = formatted.replace(/\n{3,}/g, "\n\n");
        const lines = formatted.split("\n");
        return lines
          .map((line) => {
            const trimmed = line.trimEnd();
            return trimmed;
          })
          .join("\n");
      }
      case "sql": {
        const keywords = ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN", "ON", "AND", "OR", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "UNION", "VALUES", "SET", "INTO"];
        let formatted = code.trim();
        for (const keyword of keywords) {
          const regex = new RegExp(`\\b${keyword}\\b`, "gi");
          formatted = formatted.replace(regex, keyword);
        }
        return formatted;
      }
      default:
        return code;
    }
  }

  private isLanguageSupported(language: string): language is SupportedLanguage {
    return ["javascript", "typescript", "python", "json", "sql"].includes(language);
  }

  private parseTestCases(testCode: string): Array<{ name: string; body: string }> {
    const cases: Array<{ name: string; body: string }> = [];
    const regex = /(?:test|it)\s*\(\s*['"](.+?)['"]\s*,\s*(?:function\s*)?\(\s*\)\s*\{([\s\S]*?)\}\s*\)/g;
    let match;
    while ((match = regex.exec(testCode)) !== null) {
      cases.push({ name: match[1], body: match[2] });
    }
    if (cases.length === 0) {
      cases.push({ name: "default", body: testCode });
    }
    return cases;
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
