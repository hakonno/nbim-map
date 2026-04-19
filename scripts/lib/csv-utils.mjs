export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function detectEncoding(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf16le";
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf16be";
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf8";
  }

  const sampleLength = Math.min(buffer.length, 4096);
  let nullByteCount = 0;
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0x00) {
      nullByteCount += 1;
    }
  }

  if (sampleLength > 0 && nullByteCount / sampleLength > 0.2) {
    return "utf16le";
  }

  return "utf8";
}

export function decodeBuffer(buffer, encoding) {
  if (encoding === "utf16be") {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1] ?? 0;
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }

  if (encoding === "utf16le") {
    const offset = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe ? 2 : 0;
    return buffer.slice(offset).toString("utf16le");
  }

  const offset =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0;
  return buffer.slice(offset).toString("utf8");
}

export function parseCsvLine(line, delimiter = ";") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseNonEmptyLines(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}
