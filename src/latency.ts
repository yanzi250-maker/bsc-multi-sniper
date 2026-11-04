export function measureLatency<T>(
  name: string,
  task: () => T
): T {
  const start = performance.now();

  const result = task();

  const elapsed = performance.now() - start;

  console.log(
    `[延迟监控] ${name}: ${elapsed.toFixed(2)} ms`
  );

  return result;
}
