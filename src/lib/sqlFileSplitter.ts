const MAX_CHUNK_SIZE = 100 * 1024 * 1024;

export function needsSplitting(fileSizeBytes: number): boolean {
  return fileSizeBytes > MAX_CHUNK_SIZE;
}

export function splitSQLBySize(text: string, maxChunkSize: number): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  const lines = text.split("\n");
  let currentChunk = "";
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = line.length + 1;

    if (currentSize + lineSize > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
      currentSize = 0;
    }

    currentChunk += line + "\n";
    currentSize += lineSize;
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

export {
  MAX_CHUNK_SIZE,
};
