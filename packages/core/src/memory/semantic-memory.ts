import type { MemoryEntry, MemorySearchResult, MemoryType } from "@paracosm/shared";
import { generateId } from "@paracosm/shared";
import type { SemanticEntry, Concept, MemoryRelation, Cluster, MemoryEvents, MemoryEventName } from "./types.js";
import { cosineSimilarity, normalize, dotProduct } from "./vector-store/vector-utils.js";

type EventHandler = (data: unknown) => void;

export class SemanticMemory {
  private entries: Map<string, SemanticEntry>;
  private conceptIndex: Map<string, Concept>;
  private relationStore: MemoryRelation[];
  private clusters: Cluster[];
  private listeners: Map<string, Set<EventHandler>>;
  private embeddingDimension: number;

  constructor(embeddingDimension: number = 128) {
    this.entries = new Map();
    this.conceptIndex = new Map();
    this.relationStore = [];
    this.clusters = [];
    this.listeners = new Map();
    this.embeddingDimension = embeddingDimension;
  }

  embed(text: string): number[] {
    const vector: number[] = [];
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
    const seed = this.hashString(text);

    for (let i = 0; i < this.embeddingDimension; i++) {
      let val = 0;
      for (let j = 0; j < words.length; j++) {
        const charSum = this.hashString(words[j] + i + seed);
        val += Math.sin(charSum * (i + 1) * 0.001) * 0.5;
      }
      val /= Math.max(words.length, 1);
      vector.push(val);
    }

    return normalize(vector);
  }

  index(entry: MemoryEntry, embedding?: number[]): void {
    const vector = embedding ?? this.embed(entry.content);
    const concepts = this.conceptExtraction(entry.content);

    const semanticEntry: SemanticEntry = {
      id: entry.id,
      text: entry.content,
      embedding: vector,
      concepts,
      relations: [],
      cluster: -1,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };

    this.entries.set(entry.id, semanticEntry);

    for (const concept of concepts) {
      if (!this.conceptIndex.has(concept.name)) {
        this.conceptIndex.set(concept.name, concept);
      } else {
        const existing = this.conceptIndex.get(concept.name)!;
        existing.frequency += 1;
        for (const related of concept.relatedConcepts) {
          if (!existing.relatedConcepts.includes(related)) {
            existing.relatedConcepts.push(related);
          }
        }
      }
    }

    this.emit("memory:indexed", { entryId: entry.id });
  }

  search(query: string, topK: number = 10): MemorySearchResult[] {
    const queryEmbedding = this.embed(query);
    const results: Array<{ entry: MemoryEntry; score: number; highlights: string[]; matchReason: string }> = [];

    for (const [id, semanticEntry] of this.entries) {
      const similarity = cosineSimilarity(queryEmbedding, semanticEntry.embedding);

      const queryTerms = query.toLowerCase().split(/\s+/);
      const textLower = semanticEntry.text.toLowerCase();
      let termMatchCount = 0;
      for (const term of queryTerms) {
        if (textLower.includes(term)) {
          termMatchCount += 1;
        }
      }
      const textMatchScore = queryTerms.length > 0 ? termMatchCount / queryTerms.length : 0;

      const combinedScore = similarity * 0.7 + textMatchScore * 0.3;

      if (combinedScore > 0.1) {
        const highlights = this.extractHighlights(semanticEntry.text, queryTerms);
        const memoryEntry: MemoryEntry = {
          id,
          type: "semantic" as MemoryType,
          content: semanticEntry.text,
          embedding: semanticEntry.embedding,
          importance: combinedScore,
          accessCount: 0,
          lastAccessedAt: new Date().toISOString(),
          expiresAt: null,
          tags: semanticEntry.concepts.map((c) => c.name),
          source: "semantic",
          metadata: { cluster: semanticEntry.cluster },
          createdAt: semanticEntry.createdAt,
          updatedAt: semanticEntry.updatedAt,
        };

        results.push({
          entry: memoryEntry,
          score: combinedScore,
          highlights,
          matchReason: `semantic similarity: ${similarity.toFixed(3)}, text match: ${textMatchScore.toFixed(3)}`,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  cluster(entries?: SemanticEntry[]): Cluster[] {
    const targetEntries = entries ?? Array.from(this.entries.values());
    if (targetEntries.length === 0) {
      return [];
    }

    const k = Math.min(Math.ceil(Math.sqrt(targetEntries.length)), 20);
    const maxIterations = 50;
    const convergenceThreshold = 0.001;

    let centroids = this.initializeCentroids(targetEntries, k);
    let assignments = new Array<number>(targetEntries.length).fill(-1);

    for (let iter = 0; iter < maxIterations; iter++) {
      let changed = 0;

      for (let i = 0; i < targetEntries.length; i++) {
        let bestCluster = 0;
        let bestSimilarity = -Infinity;

        for (let c = 0; c < centroids.length; c++) {
          const sim = cosineSimilarity(targetEntries[i].embedding, centroids[c]);
          if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestCluster = c;
          }
        }

        if (assignments[i] !== bestCluster) {
          assignments[i] = bestCluster;
          changed += 1;
        }
      }

      for (let c = 0; c < centroids.length; c++) {
        const members = targetEntries.filter((_, i) => assignments[i] === c);
        if (members.length === 0) continue;

        const newCentroid = new Array(this.embeddingDimension).fill(0);
        for (const member of members) {
          for (let d = 0; d < this.embeddingDimension; d++) {
            newCentroid[d] += member.embedding[d];
          }
        }
        for (let d = 0; d < this.embeddingDimension; d++) {
          newCentroid[d] /= members.length;
        }
        centroids[c] = normalize(newCentroid);
      }

      if (changed / targetEntries.length < convergenceThreshold) {
        break;
      }
    }

    this.clusters = [];
    for (let c = 0; c < centroids.length; c++) {
      const memberIds = targetEntries
        .filter((_, i) => assignments[i] === c)
        .map((e) => e.id);

      const members = targetEntries.filter((_, i) => assignments[i] === c);
      let coherence = 0;
      if (members.length > 1) {
        let totalSim = 0;
        let count = 0;
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            totalSim += cosineSimilarity(members[i].embedding, members[j].embedding);
            count += 1;
          }
        }
        coherence = count > 0 ? totalSim / count : 0;
      }

      const label = this.generateClusterLabel(members);

      this.clusters.push({
        id: c,
        centroid: centroids[c],
        memberIds,
        label,
        coherence,
      });

      for (const entry of members) {
        entry.cluster = c;
      }
    }

    return this.clusters;
  }

  deduplicate(): void {
    const entries = Array.from(this.entries.values());
    const duplicates: Set<string> = new Set();
    const similarityThreshold = 0.95;

    for (let i = 0; i < entries.length; i++) {
      if (duplicates.has(entries[i].id)) continue;

      for (let j = i + 1; j < entries.length; j++) {
        if (duplicates.has(entries[j].id)) continue;

        const similarity = cosineSimilarity(entries[i].embedding, entries[j].embedding);
        if (similarity > similarityThreshold) {
          const textSimilarity = this.textSimilarity(entries[i].text, entries[j].text);
          if (textSimilarity > 0.9) {
            const toRemove = entries[i].text.length <= entries[j].text.length
              ? entries[i].id
              : entries[j].id;
            duplicates.add(toRemove);
          }
        }
      }
    }

    for (const id of duplicates) {
      this.entries.delete(id);
    }
  }

  conceptExtraction(text: string): Concept[] {
    const concepts: Concept[] = [];
    const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const stopWords = new Set(["the", "and", "for", "are", "but", "not", "you", "all", "can", "had", "her", "was", "one", "our", "out", "has", "have", "been", "from", "that", "this", "with", "they", "will", "what", "when", "make", "like", "just", "over", "such", "take", "than", "them", "very", "also"]);

    const filtered = words.filter((w) => !stopWords.has(w) && w.length > 2);

    const bigrams: string[] = [];
    for (let i = 0; i < filtered.length - 1; i++) {
      bigrams.push(`${filtered[i]} ${filtered[i + 1]}`);
    }

    const wordFreq = new Map<string, number>();
    for (const word of filtered) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }

    const bigramFreq = new Map<string, number>();
    for (const bigram of bigrams) {
      bigramFreq.set(bigram, (bigramFreq.get(bigram) ?? 0) + 1);
    }

    for (const [bigram, freq] of bigramFreq) {
      if (freq >= 1) {
        concepts.push({
          id: generateId(),
          name: bigram,
          definition: `Compound concept: ${bigram}`,
          frequency: freq,
          relatedConcepts: bigram.split(" "),
          attributes: { type: "bigram" },
          examples: [],
        });
      }
    }

    const sortedWords = Array.from(wordFreq.entries())
      .filter(([, freq]) => freq >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    for (const [word, freq] of sortedWords) {
      const related = filtered
        .filter((w, i) => i > 0 && filtered[i - 1] === word)
        .filter((w, i, arr) => arr.indexOf(w) === i);

      concepts.push({
        id: generateId(),
        name: word,
        definition: `Extracted concept from text`,
        frequency: freq,
        relatedConcepts: related.slice(0, 5),
        attributes: { type: "unigram" },
        examples: [],
      });
    }

    return concepts;
  }

  relationMining(entries?: SemanticEntry[]): MemoryRelation[] {
    const targetEntries = entries ?? Array.from(this.entries.values());
    const newRelations: MemoryRelation[] = [];

    for (let i = 0; i < targetEntries.length; i++) {
      for (let j = i + 1; j < targetEntries.length; j++) {
        const similarity = cosineSimilarity(targetEntries[i].embedding, targetEntries[j].embedding);

        if (similarity > 0.6) {
          const sharedConcepts = targetEntries[i].concepts
            .filter((c1) => targetEntries[j].concepts.some((c2) => c1.name === c2.name))
            .map((c) => c.name);

          if (sharedConcepts.length > 0) {
            const relation: MemoryRelation = {
              source: targetEntries[i].id,
              target: targetEntries[j].id,
              type: "semantically_related",
              strength: similarity,
              bidirectional: true,
            };
            newRelations.push(relation);

            targetEntries[i].relations.push({
              source: targetEntries[i].id,
              target: targetEntries[j].id,
              type: "semantically_related",
              strength: similarity,
            });
            targetEntries[j].relations.push({
              source: targetEntries[j].id,
              target: targetEntries[i].id,
              type: "semantically_related",
              strength: similarity,
            });
          }
        }
      }
    }

    this.relationStore.push(...newRelations);
    return newRelations;
  }

  getEntry(id: string): SemanticEntry | undefined {
    return this.entries.get(id);
  }

  getConcept(name: string): Concept | undefined {
    return this.conceptIndex.get(name);
  }

  getAllConcepts(): Concept[] {
    return Array.from(this.conceptIndex.values());
  }

  getRelations(): MemoryRelation[] {
    return [...this.relationStore];
  }

  getClusters(): Cluster[] {
    return [...this.clusters];
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id);
    if (deleted) {
      this.relationStore = this.relationStore.filter(
        (r) => r.source !== id && r.target !== id
      );
      for (const cluster of this.clusters) {
        cluster.memberIds = cluster.memberIds.filter((mid) => mid !== id);
      }
    }
    return deleted;
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.conceptIndex.clear();
    this.relationStore = [];
    this.clusters = [];
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private initializeCentroids(entries: SemanticEntry[], k: number): number[][] {
    const centroids: number[][] = [];
    const step = Math.floor(entries.length / k);

    for (let i = 0; i < k; i++) {
      const idx = Math.min(i * step, entries.length - 1);
      centroids.push([...entries[idx].embedding]);
    }

    return centroids;
  }

  private generateClusterLabel(members: SemanticEntry[]): string {
    if (members.length === 0) return "empty";

    const allConcepts: Map<string, number> = new Map();
    for (const member of members) {
      for (const concept of member.concepts) {
        allConcepts.set(concept.name, (allConcepts.get(concept.name) ?? 0) + 1);
      }
    }

    const sorted = Array.from(allConcepts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return sorted.length > 0 ? sorted.join(", ") : "unlabeled";
  }

  private extractHighlights(text: string, terms: string[]): string[] {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const highlights: string[] = [];

    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      if (terms.some((term) => lower.includes(term))) {
        highlights.push(sentence.trim());
      }
      if (highlights.length >= 3) break;
    }

    return highlights;
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private emit(event: MemoryEventName, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          continue;
        }
      }
    }
  }

  on(event: MemoryEventName, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: MemoryEventName, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }
}
