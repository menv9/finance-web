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

function cleanCsvCell(value) {
  return `${value ?? ''}`.replace(/^\uFEFF/, '').trim();
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { rows: [], headers: [], delimiter };

  const rows = [];
  let headers = [];

  lines.forEach((line, index) => {
    const values = splitCsvLine(line, delimiter).map(cleanCsvCell);
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

function expandYear(year) {
  if (year.length !== 2) return Number(year);
  const twoDigitYear = Number(year);
  return twoDigitYear >= 70 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function toIsoDate(year, month, day) {
  if (!isRealDate(year, month, day)) return '';
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function parseExcelSerialDate(text) {
  if (!/^\d{5}(?:\.0+)?$/.test(text)) return '';
  const serial = Number(text);
  if (serial < 20000 || serial > 60000) return '';
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86400000);
  return toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function parseCsvDate(value) {
  const text = cleanCsvCell(value);
  if (!text) return '';

  const excelDate = parseExcelSerialDate(text);
  if (excelDate) return excelDate;

  const datePart = text
    .replace(/^[^\d]+|[^\d]+$/g, '')
    .split(/[ T]/)[0]
    .replace(/^[^\d]+|[^\d]+$/g, '');
  const isoMatch = datePart.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const europeanMatch = datePart.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (europeanMatch) {
    const day = Number(europeanMatch[1]);
    const month = Number(europeanMatch[2]);
    const year = expandYear(europeanMatch[3]);
    const europeanDate = toIsoDate(year, month, day);
    if (europeanDate) return europeanDate;
    if (day <= 12 && month > 12) return toIsoDate(year, day, month);
  }

  return '';
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
