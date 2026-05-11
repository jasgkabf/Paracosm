import { TASK_TYPES } from '@paracosm/shared';
import { createLogger } from '@paracosm/shared';

const logger = createLogger('TaskClassifier');

export interface ClassificationResult {
  taskType: string;
  confidence: number;
  subTypes: string[];
  keywords: string[];
}

const TASK_PATTERNS: Record<string, string[]> = {
  [TASK_TYPES.CODE_GENERATION]: [
    'write code', 'implement', 'create function', 'build a', 'code that',
    'program that', 'develop', 'coding', 'function that', 'class that',
    'algorithm', 'script that', 'module that', 'api endpoint', 'refactor',
    'generate code', 'write a program', 'write a function', 'write a class',
  ],
  [TASK_TYPES.CODE_REVIEW]: [
    'review', 'code review', 'check my code', 'analyze code', 'find bugs',
    'improve code', 'optimize code', 'refactor code', 'clean up', 'lint',
    'security review', 'audit code', 'code quality',
  ],
  [TASK_TYPES.ANALYSIS]: [
    'analyze', 'examine', 'investigate', 'study', 'assess', 'evaluate',
    'breakdown', 'compare', 'contrast', 'diagnose', 'interpret',
    'what does', 'explain why', 'how does', 'what causes',
  ],
  [TASK_TYPES.SUMMARIZATION]: [
    'summarize', 'summary', 'tldr', 'brief', 'condense', 'overview',
    'recap', 'outline', 'digest', 'key points', 'main ideas',
    'shorten', 'abbreviate', 'abridge',
  ],
  [TASK_TYPES.TRANSLATION]: [
    'translate', 'translation', 'convert to', 'in french', 'in spanish',
    'in german', 'in japanese', 'in chinese', 'in korean',
    'from english', 'to english', 'in another language',
  ],
  [TASK_TYPES.CREATIVE_WRITING]: [
    'write a story', 'creative', 'fiction', 'poem', 'narrative',
    'imagine', 'create a', 'compose', 'invent', 'story about',
    'tale', 'novel', 'screenplay', 'dialogue', 'lyrics',
  ],
  [TASK_TYPES.REASONING]: [
    'reason', 'logic', 'prove', 'deduce', 'infer', 'conclude',
    'argument', 'premise', 'syllogism', 'mathematical proof',
    'solve the puzzle', 'riddle', 'brain teaser', 'logical',
  ],
  [TASK_TYPES.PLANNING]: [
    'plan', 'strategy', 'roadmap', 'schedule', 'organize', 'arrange',
    'design a plan', 'step by step', 'workflow', 'process',
    'timeline', 'milestone', 'project plan',
  ],
  [TASK_TYPES.EXTRACTION]: [
    'extract', 'parse', 'find all', 'identify', 'list all', 'get all',
    'pull out', 'retrieve', 'scrape', 'collect', 'gather',
    'data extraction', 'information from',
  ],
  [TASK_TYPES.CLASSIFICATION]: [
    'classify', 'categorize', 'label', 'tag', 'sort', 'group',
    'type of', 'category', 'belong to', 'which class', 'which type',
  ],
  [TASK_TYPES.CHAT]: [
    'hello', 'hi', 'hey', 'how are you', 'what is', 'what are',
    'tell me about', 'can you', 'help me', 'question',
    'chat', 'talk', 'conversation',
  ],
};

export class TaskClassifier {
  private customPatterns: Map<string, string[]> = new Map();
  private classificationCache: Map<string, ClassificationResult> = new Map();

  classify(prompt: string, metadata?: Record<string, unknown>): string {
    if (metadata?.taskType && typeof metadata.taskType === 'string') {
      return metadata.taskType;
    }

    const result = this.classifyDetailed(prompt);
    return result.taskType;
  }

  classifyDetailed(prompt: string): ClassificationResult {
    const cacheKey = prompt.substring(0, 200);
    const cached = this.classificationCache.get(cacheKey);
    if (cached) return cached;

    const lowerPrompt = prompt.toLowerCase();
    const scores: Record<string, number> = {};
    const matchedKeywords: Record<string, string[]> = {};

    for (const [taskType, patterns] of Object.entries(TASK_PATTERNS)) {
      let score = 0;
      const keywords: string[] = [];

      for (const pattern of patterns) {
        if (lowerPrompt.includes(pattern)) {
          score += 1;
          keywords.push(pattern);
        }
      }

      if (this.customPatterns.has(taskType)) {
        for (const pattern of this.customPatterns.get(taskType)!) {
          if (lowerPrompt.includes(pattern)) {
            score += 1.5;
            keywords.push(pattern);
          }
        }
      }

      scores[taskType] = score;
      matchedKeywords[taskType] = keywords;
    }

    const sorted = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a);

    if (sorted.length === 0) {
      const result: ClassificationResult = {
        taskType: TASK_TYPES.CHAT,
        confidence: 0.3,
        subTypes: [],
        keywords: [],
      };
      this.classificationCache.set(cacheKey, result);
      return result;
    }

    const [topType, topScore] = sorted[0];
    const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
    const confidence = Math.min(topScore / totalScore, 1.0);

    const subTypes = sorted
      .slice(1, 4)
      .filter(([, score]) => score > 0)
      .map(([type]) => type);

    const result: ClassificationResult = {
      taskType: topType,
      confidence,
      subTypes,
      keywords: matchedKeywords[topType] || [],
    };

    this.classificationCache.set(cacheKey, result);
    return result;
  }

  addCustomPattern(taskType: string, patterns: string[]): void {
    const existing = this.customPatterns.get(taskType) || [];
    this.customPatterns.set(taskType, [...existing, ...patterns]);
    this.classificationCache.clear();
  }

  removeCustomPattern(taskType: string): void {
    this.customPatterns.delete(taskType);
    this.classificationCache.clear();
  }

  getTaskTypes(): string[] {
    return Object.values(TASK_TYPES);
  }

  clearCache(): void {
    this.classificationCache.clear();
  }
}
