import type {
  ToolInternal,
  ToolExecutionContext,
  ToolExecutionResult,
} from "../types.js";
import { ToolType, generateId } from "@paracosm/shared";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  relevanceScore: number;
  source: string;
  timestamp: string;
}

export interface SearchOptions {
  maxResults?: number;
  language?: string;
  region?: string;
  safeSearch?: boolean;
  timeRange?: "day" | "week" | "month" | "year";
  includeSnippets?: boolean;
}

export interface AdvancedSearchParams {
  query: string;
  site?: string;
  fileType?: string;
  excludeTerms?: string[];
  exactPhrase?: string;
  dateRange?: { start: string; end: string };
  maxResults?: number;
}

export class WebSearchTool implements ToolInternal {
  id = "web_search";
  name = "Web Search";
  type = ToolType.Search;
  description = "Search the web and extract content from URLs";
  parameters = [
    { name: "query", type: "string" as const, description: "Search query string", required: true, defaultValue: null, enum: null },
    { name: "maxResults", type: "number" as const, description: "Maximum number of results", required: false, defaultValue: 10, enum: null },
    { name: "language", type: "string" as const, description: "Language code for results", required: false, defaultValue: "en", enum: null },
  ];
  returnType = "SearchResult[]";
  returnDescription = "Array of search results with title, URL, and snippet";
  version = "1.0.0";
  deprecated = false;
  deprecationMessage = null;
  examples = [
    {
      input: { query: "TypeScript best practices" },
      output: { results: [{ title: "TypeScript Best Practices", url: "https://example.com", snippet: "Guide to TypeScript best practices" }] },
      description: "Search for TypeScript best practices",
    },
  ];
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  dependencies: string[] = [];
  category = "information";
  permissionLevel = "safe" as const;
  rateLimitPerMinute = 30;
  maxConcurrentExecutions = 5;
  requiresSandbox = false;

  async execute(
    params: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    try {
      const query = String(params.query ?? "");
      if (!query.trim()) {
        return this.errorResult("Query must be a non-empty string", startTime);
      }
      const options: SearchOptions = {
        maxResults: Number(params.maxResults) || 10,
        language: String(params.language || "en"),
        region: String(params.region || ""),
        safeSearch: params.safeSearch !== false,
        timeRange: (params.timeRange as SearchOptions["timeRange"]) ?? undefined,
        includeSnippets: params.includeSnippets !== false,
      };
      const results = this.search(query, options);
      return this.successResult(results, startTime);
    } catch (error) {
      return this.errorResult(
        error instanceof Error ? error.message : String(error),
        startTime
      );
    }
  }

  validate(params: Record<string, unknown>): boolean {
    if (!params.query || typeof params.query !== "string" || params.query.trim().length === 0) {
      return false;
    }
    if (params.maxResults !== undefined && (typeof params.maxResults !== "number" || params.maxResults < 1)) {
      return false;
    }
    return true;
  }

  search(query: string, options?: SearchOptions): SearchResult[] {
    const maxResults = options?.maxResults ?? 10;
    const results: SearchResult[] = [];
    const terms = query.toLowerCase().split(/\s+/);
    const mockDatabase = this.getMockDatabase();
    for (const entry of mockDatabase) {
      const titleLower = entry.title.toLowerCase();
      const snippetLower = entry.snippet.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (titleLower.includes(term)) score += 3;
        if (snippetLower.includes(term)) score += 1;
      }
      if (score > 0) {
        results.push({
          ...entry,
          relevanceScore: Math.min(score / (terms.length * 4), 1),
          timestamp: entry.timestamp,
        });
      }
    }
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results.slice(0, maxResults);
  }

  advancedSearch(params: AdvancedSearchParams): SearchResult[] {
    let query = params.query;
    if (params.site) {
      query += ` site:${params.site}`;
    }
    if (params.fileType) {
      query += ` filetype:${params.fileType}`;
    }
    if (params.excludeTerms && params.excludeTerms.length > 0) {
      query += " " + params.excludeTerms.map((t) => `-${t}`).join(" ");
    }
    if (params.exactPhrase) {
      query += ` "${params.exactPhrase}"`;
    }
    const results = this.search(query, {
      maxResults: params.maxResults ?? 10,
    });
    if (params.dateRange) {
      const start = new Date(params.dateRange.start).getTime();
      const end = new Date(params.dateRange.end).getTime();
      return results.filter((r) => {
        const ts = new Date(r.timestamp).getTime();
        return ts >= start && ts <= end;
      });
    }
    return results;
  }

  extractContent(url: string): string {
    if (!url || typeof url !== "string") {
      return "";
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "";
      }
      const domain = parsed.hostname;
      const path = parsed.pathname;
      return `[Content extracted from ${domain}${path}]\n\nThis is extracted content from the requested URL. In a production environment, this would fetch and parse the actual page content, extracting the main article text, removing navigation elements, scripts, and stylesheets.\n\nURL: ${url}\nDomain: ${domain}\nPath: ${path}\nRetrieved at: ${new Date().toISOString()}`;
    } catch {
      return "";
    }
  }

  summarize(content: string, maxLength: number): string {
    if (!content || typeof content !== "string") {
      return "";
    }
    if (maxLength <= 0) {
      return "";
    }
    if (content.length <= maxLength) {
      return content;
    }
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) {
      return content.slice(0, maxLength);
    }
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      const words = sentence.trim().split(/\s+/);
      score += Math.min(words.length / 20, 1) * 2;
      if (index === 0) score += 3;
      if (index === sentences.length - 1) score += 1;
      const firstSentenceWords = sentences[0].trim().split(/\s+/);
      for (const word of words) {
        if (firstSentenceWords.includes(word)) {
          score += 0.5;
        }
      }
      return { sentence: sentence.trim(), score };
    });
    scoredSentences.sort((a, b) => b.score - a.score);
    let summary = "";
    const selectedSentences: Array<{ sentence: string; index: number }> = [];
    for (let i = 0; i < scoredSentences.length; i++) {
      const originalIndex = sentences.indexOf(scoredSentences[i].sentence);
      if (summary.length + scoredSentences[i].sentence.length + 1 <= maxLength) {
        selectedSentences.push({ sentence: scoredSentences[i].sentence, index: originalIndex });
        summary += scoredSentences[i].sentence + ". ";
      } else {
        break;
      }
    }
    selectedSentences.sort((a, b) => a.index - b.index);
    return selectedSentences.map((s) => s.sentence).join(". ") + ".";
  }

  private getMockDatabase(): Array<{ title: string; url: string; snippet: string; source: string; timestamp: string }> {
    return [
      { title: "TypeScript Documentation", url: "https://www.typescriptlang.org/docs/", snippet: "Official TypeScript documentation covering types, interfaces, generics, and more", source: "typescriptlang.org", timestamp: "2025-01-15T10:00:00Z" },
      { title: "Node.js Best Practices", url: "https://nodejs.org/en/docs/guides/", snippet: "Guide to Node.js best practices including error handling and performance", source: "nodejs.org", timestamp: "2025-02-10T12:00:00Z" },
      { title: "Web API Design Patterns", url: "https://example.com/api-patterns", snippet: "Common design patterns for building RESTful and GraphQL APIs", source: "example.com", timestamp: "2025-03-05T08:00:00Z" },
      { title: "JavaScript Performance Optimization", url: "https://example.com/js-perf", snippet: "Techniques for optimizing JavaScript application performance", source: "example.com", timestamp: "2025-01-20T14:00:00Z" },
      { title: "React Component Patterns", url: "https://react.dev/learn", snippet: "Learn React component patterns and best practices for building UIs", source: "react.dev", timestamp: "2025-04-01T09:00:00Z" },
      { title: "Python Machine Learning Guide", url: "https://example.com/ml-guide", snippet: "Comprehensive guide to machine learning with Python and scikit-learn", source: "example.com", timestamp: "2025-02-28T16:00:00Z" },
      { title: "Database Design Principles", url: "https://example.com/db-design", snippet: "Fundamental principles of relational and NoSQL database design", source: "example.com", timestamp: "2025-03-15T11:00:00Z" },
      { title: "Cloud Architecture Best Practices", url: "https://example.com/cloud-arch", snippet: "Best practices for designing scalable cloud architectures", source: "example.com", timestamp: "2025-01-30T13:00:00Z" },
    ];
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
