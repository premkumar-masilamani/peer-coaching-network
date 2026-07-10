// Split an array into chunks of at most `size`. Used for Firestore `in`
// queries and batched document reads, which accept up to 30 values.
export const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};
