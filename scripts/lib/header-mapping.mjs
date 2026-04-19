function normalizeHeader(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function scoreHeaderMatch(header, alias) {
  if (header === alias) {
    return 100;
  }

  if (header.includes(alias)) {
    return 80;
  }

  if (alias.includes(header) && header.length >= 4) {
    return 70;
  }

  return 0;
}

export function mapHeaders(headers, rules) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const usedIndices = new Set();
  const mapped = {};

  for (const rule of rules) {
    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < normalizedHeaders.length; index += 1) {
      if (usedIndices.has(index)) {
        continue;
      }

      const header = normalizedHeaders[index];
      let score = 0;
      for (const alias of rule.aliases) {
        const aliasScore = scoreHeaderMatch(header, alias);
        if (aliasScore > score) {
          score = aliasScore;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestScore <= 0) {
      bestIndex = -1;
    }

    if (rule.required && bestIndex === -1) {
      throw new Error(`Missing required column for ${rule.key}`);
    }

    if (bestIndex !== -1) {
      usedIndices.add(bestIndex);
    }

    mapped[rule.key] = bestIndex;
  }

  return mapped;
}
