export type CsvContactRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  website: string;
  address: string;
  tags: string;
};

export type CsvContactRowWithMeta = CsvContactRow & {
  lineNumber: number;
};

export type ContactsCsvValidationResult = {
  rows: CsvContactRowWithMeta[];
  headerErrors: string[];
  normalizedHeaders: string[];
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
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
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

export function parseContactsCsv(text: string): CsvContactRow[] {
  return parseContactsCsvWithValidation(text).rows.map(({ lineNumber: _lineNumber, ...row }) => row);
}

export function parseContactsCsvWithValidation(text: string): ContactsCsvValidationResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], headerErrors: ["CSV is empty."], normalizedHeaders: [] };
  }

  const rawHeaders = parseCsvLine(lines[0]).map((header) => header.trim());
  const headers = rawHeaders.map(normalizeHeader);
  const indexOf = (keys: string[]) => headers.findIndex((header) => keys.includes(header));
  const fieldIndex = {
    firstName: indexOf(["firstname", "first"]),
    lastName: indexOf(["lastname", "last"]),
    email: indexOf(["email", "emailaddress"]),
    phone: indexOf(["phone", "phonenumber"]),
    business: indexOf(["business", "company"]),
    website: indexOf(["website", "url"]),
    address: indexOf(["address"]),
    tags: indexOf(["tags", "tag"]),
  };

  const requiredHeaders = [
    { field: "firstName", labels: ["First Name", "first"] },
    { field: "email", labels: ["Email", "emailAddress"] },
  ] as const;
  const optionalHeaders = [
    { field: "lastName", labels: ["Last Name", "last"] },
    { field: "phone", labels: ["Phone", "phoneNumber"] },
    { field: "business", labels: ["Business", "company"] },
    { field: "website", labels: ["Website", "url"] },
    { field: "address", labels: ["Address"] },
    { field: "tags", labels: ["Tags", "tag"] },
  ] as const;
  const headerErrors: string[] = [];
  const duplicateHeaderErrors: string[] = [];

  for (const column of requiredHeaders) {
    if (fieldIndex[column.field] < 0) {
      headerErrors.push(`Missing required header "${column.labels[0]}".`);
    }
  }

  const blankHeaderPositions = rawHeaders
    .map((header, index) => ({ header, index }))
    .filter((entry) => entry.header.length === 0)
    .map((entry) => entry.index + 1);
  if (blankHeaderPositions.length > 0) {
    headerErrors.push(`Blank header column(s) at position(s): ${blankHeaderPositions.join(", ")}.`);
  }

  const headerCounts = new Map<string, { count: number; samples: string[] }>();
  for (let i = 0; i < headers.length; i += 1) {
    const normalized = headers[i];
    if (!normalized) continue;
    const existing = headerCounts.get(normalized);
    if (existing) {
      existing.count += 1;
      if (rawHeaders[i] && !existing.samples.includes(rawHeaders[i])) {
        existing.samples.push(rawHeaders[i]);
      }
      continue;
    }
    headerCounts.set(normalized, {
      count: 1,
      samples: rawHeaders[i] ? [rawHeaders[i]] : [],
    });
  }
  for (const [normalized, info] of headerCounts.entries()) {
    if (info.count <= 1) continue;
    const sampleLabel = info.samples.length > 0 ? info.samples.join(" / ") : normalized;
    duplicateHeaderErrors.push(`Duplicate header "${sampleLabel}" appears ${info.count} times.`);
  }
  headerErrors.push(...duplicateHeaderErrors);

  const allowedHeaderKeys = new Set<string>();
  for (const column of [...requiredHeaders, ...optionalHeaders]) {
    for (const label of column.labels) {
      allowedHeaderKeys.add(normalizeHeader(label));
    }
  }
  const unknownHeaders = headers
    .map((header, index) => ({ normalized: header, raw: rawHeaders[index] || "" }))
    .filter((entry) => entry.normalized && !allowedHeaderKeys.has(entry.normalized))
    .map((entry) => entry.raw || entry.normalized);
  if (unknownHeaders.length > 0) {
    headerErrors.push(`Unsupported header column(s): ${Array.from(new Set(unknownHeaders)).join(", ")}.`);
  }

  const rows = lines.slice(1).map((line, index) => {
    const row = parseCsvLine(line);
    const pick = (idx: number) => (idx >= 0 ? String(row[idx] || "").trim() : "");
    return {
      lineNumber: index + 2,
      firstName: pick(fieldIndex.firstName),
      lastName: pick(fieldIndex.lastName),
      email: pick(fieldIndex.email).toLowerCase(),
      phone: pick(fieldIndex.phone),
      business: pick(fieldIndex.business),
      website: pick(fieldIndex.website),
      address: pick(fieldIndex.address),
      tags: pick(fieldIndex.tags),
    };
  });

  return {
    rows,
    headerErrors,
    normalizedHeaders: headers,
  };
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/"/g, '""');
  return `"${normalized}"`;
}

export function toContactsCsv(rows: CsvContactRow[]) {
  const header = ["First Name", "Last Name", "Email", "Phone", "Business", "Website", "Address", "Tags"];
  const lines = rows.map((row) =>
    [
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.business,
      row.website,
      row.address,
      row.tags,
    ]
      .map((cell) => escapeCsvCell(cell || ""))
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
