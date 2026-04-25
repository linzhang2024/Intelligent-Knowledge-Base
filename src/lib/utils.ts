export function formatFileSize(bytes: bigint | number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return "未知";
  }

  const bytesNum = typeof bytes === "bigint" ? Number(bytes) : bytes;

  if (bytesNum === 0) {
    return "0 B";
  }

  if (bytesNum < 0) {
    return "未知";
  }

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytesNum) / Math.log(k));

  if (i >= sizes.length) {
    return (bytesNum / Math.pow(k, sizes.length - 1)).toFixed(2) + " " + sizes[sizes.length - 1];
  }

  const value = bytesNum / Math.pow(k, i);
  return parseFloat(value.toFixed(2)) + " " + sizes[i];
}
