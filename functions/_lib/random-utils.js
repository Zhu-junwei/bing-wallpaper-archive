export const MAX_RANDOM_LIMIT = 3650;

export function parseRandomLimit(text) {
  if (!/^\d+$/.test(text || "")) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }
  return Math.min(value, MAX_RANDOM_LIMIT);
}

export function pickRandomItems(items, count) {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) {
    return [];
  }

  const limit = Math.min(count, items.length);
  const pool = items.slice();

  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, limit);
}
