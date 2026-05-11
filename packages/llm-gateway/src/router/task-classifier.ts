import type { LLMRequest, LLMMessage } from "@paracosm/shared";
import { Logger } from "@paracosm/shared";

const logger = new Logger("TaskClassifier");

export interface TaskFeatures {
  messageCount: number;
  totalLength: number;
  avgMessageLength: number;
  hasCodeBlocks: boolean;
  codeBlockCount: number;
  hasQuestions: boolean;
  questionCount: number;
  hasInstructions: boolean;
  instructionKeywords: number;
  hasCreativeKeywords: boolean;
  creativeKeywordCount: number;
  hasAnalysisKeywords: boolean;
  analysisKeywordCount: number;
  hasSimulationKeywords: boolean;
  simulationKeywordCount: number;
  systemPromptLength: number;
  userMessageCount: number;
  hasFunctionDefinitions: boolean;
  functionCount: number;
  complexityScore: number;
}

const CODE_PATTERNS = [/```[\s\S]*?```/g, /`[^`]+`/g, /function\s+\w+/, /class\s+\w+/, /import\s+/];
const QUESTION_PATTERNS = [/\?/g, /^(how|what|why|when|where|who|which|can|could|would|should|is|are|do|does)\b/gim];
const INSTRUCTION_KEYWORDS = ["create", "build", "implement", "design", "develop", "write", "generate", "make", "construct", "compose", "refactor", "optimize", "fix", "debug", "solve"];
const CREATIVE_KEYWORDS = ["story", "poem", "creative", "imagine", "fiction", "narrative", "character", "plot", "dialogue", "scene", "write a", "compose a", "invent"];
const ANALYSIS_KEYWORDS = ["analyze", "compare", "evaluate", "assess", "review", "examine", "investigate", "study", "interpret", "summarize", "explain", "breakdown", "critique"];
const SIMULATION_KEYWORDS = ["simulate", "simulation", "model", "predict", "forecast", "scenario", "what-if", "monte carlo", "mcts", "tree search", "path finding"];

export class TaskClassifier {
  private featureCache: Map<string, { features: TaskFeatures; timestamp: number }> = new Map();
  private cacheTtlMs: number = 60000;

  classify(request: LLMRequest): string {
    const features = this.extractFeatures(request);
    const category = this.predictCategory(features);
    logger.debug(`Classified request as: ${category}`, { requestId: request.id, complexity: features.complexityScore });
    return category;
  }

  extractFeatures(request: LLMRequest): TaskFeatures {
    const cacheKey = request.id;
    const cached = this.featureCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.features;
    }

    const messages = request.messages;
    const messageCount = messages.length;
    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const avgMessageLength = messageCount > 0 ? totalLength / messageCount : 0;

    const allContent = messages.map((m) => m.content).join("\n");

    let hasCodeBlocks = false;
    let codeBlockCount = 0;
    for (const pattern of CODE_PATTERNS) {
      const matches = allContent.match(pattern);
      if (matches && matches.length > 0) {
        hasCodeBlocks = true;
        codeBlockCount += matches.length;
      }
    }

    let hasQuestions = false;
    let questionCount = 0;
    for (const pattern of QUESTION_PATTERNS) {
      const matches = allContent.match(pattern);
      if (matches && matches.length > 0) {
        hasQuestions = true;
        questionCount += matches.length;
      }
    }

    const lowerContent = allContent.toLowerCase();
    const instructionKeywords = INSTRUCTION_KEYWORDS.filter((kw) => lowerContent.includes(kw)).length;
    const creativeKeywordCount = CREATIVE_KEYWORDS.filter((kw) => lowerContent.includes(kw)).length;
    const analysisKeywordCount = ANALYSIS_KEYWORDS.filter((kw) => lowerContent.includes(kw)).length;
    const simulationKeywordCount = SIMULATION_KEYWORDS.filter((kw) => lowerContent.includes(kw)).length;

    const systemMessage = messages.find((m) => m.role === "system");
    const systemPromptLength = systemMessage?.content.length ?? 0;
    const userMessageCount = messages.filter((m) => m.role === "user").length;
    const hasFunctionDefinitions = !!request.functions && request.functions.length > 0;
    const functionCount = request.functions?.length ?? 0;

    const complexityScore = this.calculateComplexity({
      messageCount,
      totalLength,
      codeBlockCount,
      questionCount,
      instructionKeywords,
      creativeKeywordCount,
      analysisKeywordCount,
      simulationKeywordCount,
      systemPromptLength,
      functionCount,
    });

    const features: TaskFeatures = {
      messageCount,
      totalLength,
      avgMessageLength,
      hasCodeBlocks,
      codeBlockCount,
      hasQuestions,
      questionCount,
      hasInstructions: instructionKeywords > 0,
      instructionKeywords,
      hasCreativeKeywords: creativeKeywordCount > 0,
      creativeKeywordCount,
      hasAnalysisKeywords: analysisKeywordCount > 0,
      analysisKeywordCount,
      hasSimulationKeywords: simulationKeywordCount > 0,
      simulationKeywordCount,
      systemPromptLength,
      userMessageCount,
      hasFunctionDefinitions,
      functionCount,
      complexityScore,
    };

    this.featureCache.set(cacheKey, { features, timestamp: Date.now() });
    return features;
  }

  predictCategory(features: TaskFeatures): string {
    const scores: Record<string, number> = {
      simple_chat: 0,
      code_generation: 0,
      complex_reasoning: 0,
      simulation: 0,
      persona_debate: 0,
      creative: 0,
      analysis: 0,
    };

    scores.simple_chat += features.messageCount <= 2 ? 2 : 0;
    scores.simple_chat += features.totalLength < 500 ? 1.5 : 0;
    scores.simple_chat += features.hasQuestions && !features.hasCodeBlocks ? 1 : 0;
    scores.simple_chat += features.complexityScore < 0.3 ? 1 : 0;

    scores.code_generation += features.hasCodeBlocks ? 3 : 0;
    scores.code_generation += features.codeBlockCount * 0.5;
    scores.code_generation += features.instructionKeywords > 0 && features.hasCodeBlocks ? 1 : 0;
    scores.code_generation += features.functionCount > 0 ? 0.5 : 0;

    scores.complex_reasoning += features.totalLength > 2000 ? 1.5 : 0;
    scores.complex_reasoning += features.messageCount > 5 ? 1 : 0;
    scores.complex_reasoning += features.systemPromptLength > 500 ? 1 : 0;
    scores.complex_reasoning += features.functionCount > 3 ? 1 : 0;
    scores.complex_reasoning += features.complexityScore > 0.7 ? 1.5 : 0;

    scores.simulation += features.simulationKeywordCount * 2;
    scores.simulation += features.hasSimulationKeywords ? 2 : 0;
    scores.simulation += features.complexityScore > 0.5 ? 0.5 : 0;

    scores.persona_debate += features.messageCount > 8 ? 1 : 0;
    scores.persona_debate += features.totalLength > 5000 ? 1 : 0;
    scores.persona_debate += features.systemPromptLength > 1000 ? 0.5 : 0;

    scores.creative += features.creativeKeywordCount * 2;
    scores.creative += features.hasCreativeKeywords ? 2 : 0;
    scores.creative += !features.hasCodeBlocks && !features.hasAnalysisKeywords ? 0.5 : 0;

    scores.analysis += features.analysisKeywordCount * 2;
    scores.analysis += features.hasAnalysisKeywords ? 2 : 0;
    scores.analysis += features.totalLength > 1000 && !features.hasCodeBlocks ? 0.5 : 0;

    let bestCategory = "simple_chat";
    let bestScore = -Infinity;
    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private calculateComplexity(features: Partial<TaskFeatures>): number {
    let score = 0;
    const maxScore = 10;

    if (features.messageCount !== undefined) {
      score += Math.min(features.messageCount / 10, 1);
    }
    if (features.totalLength !== undefined) {
      score += Math.min(features.totalLength / 10000, 1);
    }
    if (features.codeBlockCount !== undefined) {
      score += Math.min(features.codeBlockCount / 5, 1);
    }
    if (features.functionCount !== undefined) {
      score += Math.min(features.functionCount / 5, 1);
    }
    if (features.systemPromptLength !== undefined) {
      score += Math.min(features.systemPromptLength / 2000, 1);
    }
    if (features.instructionKeywords !== undefined) {
      score += Math.min(features.instructionKeywords / 5, 1);
    }
    if (features.simulationKeywordCount !== undefined) {
      score += Math.min(features.simulationKeywordCount / 3, 1);
    }
    if (features.analysisKeywordCount !== undefined) {
      score += Math.min(features.analysisKeywordCount / 3, 1);
    }
    if (features.creativeKeywordCount !== undefined) {
      score += Math.min(features.creativeKeywordCount / 3, 0.5);
    }
    if (features.questionCount !== undefined) {
      score += Math.min(features.questionCount / 5, 0.5);
    }

    return Math.min(score / maxScore, 1);
  }

  clearCache(): void {
    this.featureCache.clear();
  }
}
