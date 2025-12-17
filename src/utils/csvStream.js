// Streaming-ish CSV reader for large files (supports quoted fields with commas).
// Works with both Response bodies and File streams.

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // escaped quote inside quoted field => ""
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function streamTextLines(stream, onLine) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx = buf.indexOf('\n');
    while (idx !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, '');
      buf = buf.slice(idx + 1);
      onLine(line);
      idx = buf.indexOf('\n');
    }
  }

  buf += decoder.decode();
  const finalLine = buf.replace(/\r$/, '');
  if (finalLine) onLine(finalLine);
}

function toNum(x) {
  const n = Number.parseFloat(String(x ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

export async function aggregateMonthlySalesFromStream(readableStream) {
  // Aggregates ALL metrics at once so UI can switch without re-parsing.
  const totalsByMonth = new Map(); // monthKey => { retailSales, retailTransfers, warehouseSales }
  const byTypeMonth = new Map(); // type => Map(monthKey => { ... })
  const types = new Set();

  let header = null;
  let col = null;
  let lineNum = 0;

  const ensureBucket = (map, key) => {
    let v = map.get(key);
    if (!v) {
      v = { retailSales: 0, retailTransfers: 0, warehouseSales: 0 };
      map.set(key, v);
    }
    return v;
  };

  await streamTextLines(readableStream, (line) => {
    lineNum++;
    if (!line) return;

    if (!header) {
      header = parseCsvLine(line).map((h) => h.trim());
      const idx = (name) => header.findIndex((h) => h.toUpperCase() === name);
      col = {
        year: idx('YEAR'),
        month: idx('MONTH'),
        itemType: idx('ITEM TYPE'),
        retailSales: idx('RETAIL SALES'),
        retailTransfers: idx('RETAIL TRANSFERS'),
        warehouseSales: idx('WAREHOUSE SALES'),
      };
      return;
    }

    const row = parseCsvLine(line);
    const year = row[col.year];
    const month = row[col.month];
    if (!year || !month) return;

    const monthKey = `${String(year).trim()}-${String(month).trim().padStart(2, '0')}`;
    const itemTypeRaw = row[col.itemType] ?? 'Unknown';
    const itemType = String(itemTypeRaw).trim() || 'Unknown';
    types.add(itemType);

    const retailSales = toNum(row[col.retailSales]);
    const retailTransfers = toNum(row[col.retailTransfers]);
    const warehouseSales = toNum(row[col.warehouseSales]);

    const totalBucket = ensureBucket(totalsByMonth, monthKey);
    totalBucket.retailSales += retailSales;
    totalBucket.retailTransfers += retailTransfers;
    totalBucket.warehouseSales += warehouseSales;

    let typeMap = byTypeMonth.get(itemType);
    if (!typeMap) {
      typeMap = new Map();
      byTypeMonth.set(itemType, typeMap);
    }
    const typeBucket = ensureBucket(typeMap, monthKey);
    typeBucket.retailSales += retailSales;
    typeBucket.retailTransfers += retailTransfers;
    typeBucket.warehouseSales += warehouseSales;
  });

  const months = Array.from(totalsByMonth.keys()).sort();
  const typeList = Array.from(types).sort((a, b) => a.localeCompare(b));

  return {
    months,
    typeList,
    totalsByMonth,
    byTypeMonth,
    rowsParsed: Math.max(0, lineNum - 1),
  };
}


