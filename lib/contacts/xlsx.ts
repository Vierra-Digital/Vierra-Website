import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import {
  putFileAsset,
  deleteFileAsset,
  STORAGE_BUCKETS,
  toStorageKeySegment,
} from "@/lib/storage";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Remove any object-storage files backing the StoredFile rows matched by `where`. */
async function cleanupStoredFileObjects(where: Prisma.StoredFileWhereInput) {
  const rows = await prisma.storedFile.findMany({ where, select: { storageKey: true } });
  await Promise.all(rows.map((r) => deleteFileAsset(STORAGE_BUCKETS.docs, r.storageKey)));
}

type SyncContactsSpreadsheetInput = {
  userId: number;
};

type RawContactRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  business: string;
  website: string;
  address: string;
};

type RawColumnKey = keyof RawContactRow;
type SpreadsheetColumn = { key: RawColumnKey; header: string };

function asSheetValue(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || "N/A";
}

export async function syncContactsSpreadsheetForUser(input: SyncContactsSpreadsheetInput) {
  const contacts = await prisma.contact.findMany({
    where: { userId: input.userId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { createdAt: "desc" }],
  });

  const signingTokenId = `contacts-xlsx:${input.userId}`;
  const legacyWhere: Prisma.StoredFileWhereInput = {
    userId: input.userId,
    fileType: "xlsx",
    signingTokenId: { startsWith: `contacts-xlsx:${input.userId}:` },
  };
  await cleanupStoredFileObjects(legacyWhere);
  await prisma.storedFile.deleteMany({ where: legacyWhere });
  if (contacts.length === 0) {
    const emptyWhere: Prisma.StoredFileWhereInput = {
      userId: input.userId,
      signingTokenId,
      fileType: "xlsx",
    };
    await cleanupStoredFileObjects(emptyWhere);
    await prisma.storedFile.deleteMany({ where: emptyWhere });
    return { saved: false as const };
  }

  const rawRows = contacts.map((contact) => ({
    firstName: typeof contact.firstName === "string" ? contact.firstName.trim() : "",
    lastName: typeof contact.lastName === "string" ? contact.lastName.trim() : "",
    email: typeof contact.email === "string" ? contact.email.trim() : "",
    phone: typeof contact.phone === "string" ? contact.phone.trim() : "",
    business: typeof contact.business === "string" ? contact.business.trim() : "",
    website: typeof contact.website === "string" ? contact.website.trim() : "",
    address: typeof contact.address === "string" ? contact.address.trim() : "",
  }));

  const allColumns: SpreadsheetColumn[] = [
    { key: "firstName", header: "First Name" },
    { key: "lastName", header: "Last Name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "business", header: "Business" },
    { key: "website", header: "Website" },
    { key: "address", header: "Address" },
  ];
  const columns = allColumns.filter((column) =>
    rawRows.some((row) => String(row[column.key] || "").trim().length > 0)
  );

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contacts");
  worksheet.columns = columns.map((column) => ({
    key: column.key,
    header: column.header,
    width:
      column.key === "email"
        ? 36
        : Math.max(column.header.length + 2, 14),
  }));

  for (const row of rawRows) {
    const nextRow: Record<string, string> = {};
    for (const column of columns) {
      nextRow[column.key] = asSheetValue(row[column.key]);
    }
    worksheet.addRow(nextRow);
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell((cell) => {
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  });

  const workbookBytes = await workbook.xlsx.writeBuffer();
  const workbookBuffer = Buffer.from(workbookBytes);
  const fileName = "Contacts.xlsx";

  const storageKey = await putFileAsset(
    STORAGE_BUCKETS.docs,
    `documents/${toStorageKeySegment(signingTokenId)}.xlsx`,
    workbookBuffer,
    XLSX_CONTENT_TYPE
  );

  const existing = await prisma.storedFile.findFirst({
    where: {
      userId: input.userId,
      signingTokenId,
      fileType: "xlsx",
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.storedFile.update({
      where: { id: existing.id },
      data: {
        name: fileName,
        storageKey,
        isDeletionProtected: true,
      },
    });
  } else {
    await prisma.storedFile.create({
      data: {
        userId: input.userId,
        name: fileName,
        signingTokenId,
        fileType: "xlsx",
        storageKey,
        isDeletionProtected: true,
      },
    });
  }

  return { saved: true as const, fileName, rows: rawRows.length };
}

