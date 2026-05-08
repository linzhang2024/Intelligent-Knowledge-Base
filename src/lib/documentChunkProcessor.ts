import { sanitizeAndSplitChunks } from "@/lib/textSanitizer";
import { DEFAULT_RAG_CONFIG, DEFAULT_SQL_RAG_CONFIG } from "@/lib/ragConfig";

export const BATCH_SIZE = 200;

export function splitTextIntoChunks(
  text: string,
  chunkSize: number = DEFAULT_RAG_CONFIG.chunkSize,
  overlap: number = DEFAULT_RAG_CONFIG.chunkOverlap
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  const sentences = text.split(/([。！？.!?\n])/).filter((s) => s.trim());

  let currentChunk = "";

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "");

    if (
      currentChunk.length + sentence.length > chunkSize &&
      currentChunk.length > 0
    ) {
      chunks.push(currentChunk.trim());

      if (overlap > 0 && currentChunk.length > overlap) {
        const lastPart = currentChunk.slice(-overlap);
        const lastSentenceMatch = lastPart.match(
          /[^。！？.!?\n]*[。！？.!?\n]?$/
        );
        currentChunk = lastSentenceMatch ? lastSentenceMatch[0] : lastPart;
      } else {
        currentChunk = "";
      }
    }

    currentChunk += sentence;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export function splitSQLIntoChunks(text: string): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const pattern =
    /(CREATE\s+(OR\s+REPLACE\s+)?(TABLE|FUNCTION|PROCEDURE|PACKAGE|VIEW|INDEX|TRIGGER|SYNONYM|SEQUENCE|TYPE|CONTEXT|DIRECTORY|JAVA))/gi;
  const positions: number[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    positions.push(match.index);
  }

  if (positions.length === 0) {
    return [text];
  }

  const chunks: string[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i];
    const end = positions[i + 1] || text.length;
    const chunk = text.substring(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

export { DEFAULT_RAG_CONFIG, DEFAULT_SQL_RAG_CONFIG };
