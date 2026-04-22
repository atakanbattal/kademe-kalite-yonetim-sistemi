/**
 * Deadlock (40P01) veya geçici veritabanı hatalarında yeniden dene.
 * @param {Function} fn - async () => T
 * @param {Object} options - { maxRetries?: number, delayMs?: number }
 * @returns {Promise<T>}
 */
export async function withRetryOnDeadlock(fn, { maxRetries = 3, delayMs = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code = err?.code ?? err?.error?.code ?? err?.cause?.code;
      const isDeadlock = code === '40P01';
      const isRetryable = isDeadlock || code === '40001'; // serialization failure
      if (!isRetryable || attempt >= maxRetries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
