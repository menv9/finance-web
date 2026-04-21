function splitCsvLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function detectDelimiter(text) {
  const firstLine = text.trim().split(/\r?\n/).find(Boolean) || '';
  const candidates = [',', ';', '\t'];
  return candidates
    .map((delimiter) => ({ delimiter, count: splitCsvLine(firstLine, delimiter).length }))
    .sort((left, right) => right.count - left.count)[0]?.delimiter || ',';
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { rows: [], headers: [], delimiter };

  const rows = [];
  let headers = [];

  lines.forEach((line, index) => {
    const values = splitCsvLine(line, delimiter);
    if (index === 0) {
      headers = values;
    } else {
      rows.push(
        headers.reduce((accumulator, header, valueIndex) => {
          accumulator[header] = values[valueIndex] ?? '';
          return accumulator;
        }, {}),
      );
    }
  });

  return { rows, headers, delimiter };
}

export function parseAmountToCents(value) {
  const text = `${value ?? ''}`.trim();
  if (!text) return Number.NaN;

  const normalized = text
    .replace(/\s/g, '')
    .replace(/[€$£]/g, '')
    .replace(/\.(?=.*[.,]\d{2}$)/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(',', '.');

  return Math.round(Number(normalized) * 100);
}

export function rowsToCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const serialize = (value) => {
    const text = `${value ?? ''}`;
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  return [headers.join(','), ...rows.map((row) => headers.map((header) => serialize(row[header])).join(','))].join('\n');
}
