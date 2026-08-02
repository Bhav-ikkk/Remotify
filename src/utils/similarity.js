/** Lightweight English stop words for token filtering. */
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "when",
  "at",
  "by",
  "for",
  "with",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "to",
  "from",
  "up",
  "down",
  "in",
  "out",
  "on",
  "off",
  "over",
  "under",
  "again",
  "further",
  "once",
  "here",
  "there",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "having",
  "do",
  "does",
  "did",
  "doing",
  "of",
  "as",
  "this",
  "that",
  "these",
  "those",
  "you",
  "your",
  "yours",
  "we",
  "our",
  "ours",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "why",
  "where",
  "role",
  "job",
  "position",
  "team",
  "work",
  "working",
  "experience",
  "years",
  "year",
  "including",
  "across",
  "using",
  "use",
  "used",
]);

/**
 * Tokenize text into a set of meaningful lowercase word stems.
 * @param {string} text
 * @returns {Set<string>}
 */
export function tokenize(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]/g, " ")
    .split(/[\s/_|,;:()-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  return new Set(tokens);
}

/**
 * Jaccard similarity over tokenized word sets (intersection / union).
 * Returns a float in [0, 1]. Empty inputs yield 0.
 * @param {string} str1
 * @param {string} str2
 * @returns {number}
 */
export function calculateSimilarity(str1, str2) {
  const a = tokenize(str1);
  const b = tokenize(str2);

  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}
