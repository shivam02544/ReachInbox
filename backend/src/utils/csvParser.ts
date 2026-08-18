import { parse } from 'csv-parse/sync';

export interface ParseCsvResult {
  rawEmails: string[];
  totalRows: number;
}

export function parseCsvBuffer(buffer: Buffer): ParseCsvResult {
  if (!buffer || buffer.length === 0) {
    throw new Error('CSV file is empty.');
  }

  let records: Record<string, any>[];

  try {
    records = parse(buffer, {
      columns: true,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: false,
    });
  } catch (err: any) {
    throw new Error(`Invalid CSV format: ${err.message || 'Malformed CSV content'}`);
  }

  if (!records || records.length === 0) {
    throw new Error('CSV file contains no data rows.');
  }

  // Identify case-insensitive 'email' column header
  const sampleRow = records[0];
  const headers = Object.keys(sampleRow);
  const emailHeader = headers.find((h) => h.trim().toLowerCase() === 'email');

  if (!emailHeader) {
    throw new Error("Invalid CSV format: Required header 'email' (case-insensitive) not found.");
  }

  const rawEmails: string[] = [];
  for (const row of records) {
    const val = row[emailHeader];
    if (val !== undefined && val !== null) {
      const strVal = String(val).trim();
      if (strVal.length > 0) {
        rawEmails.push(strVal);
      }
    }
  }

  return {
    rawEmails,
    totalRows: records.length,
  };
}
