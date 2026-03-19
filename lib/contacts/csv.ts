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
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
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

  return lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    const pick = (idx: number) => (idx >= 0 ? String(row[idx] || "").trim() : "");
    return {
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
