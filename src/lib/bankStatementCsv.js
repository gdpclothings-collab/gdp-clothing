const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function uniqueHeaders(rawHeaders) {
  const used = new Map();
  return rawHeaders.map((value, index) => {
    const base = String(value || "").replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`;
    const count = (used.get(base) || 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

export function parseBankCsv(text) {
  const input = String(text || "");
  if (!input.trim()) throw new Error("The CSV file is empty.");

  const matrix = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => String(cell || "").trim() !== "")) matrix.push(row);
      row = [];
      continue;
    }
    field += char;
  }

  if (quoted) throw new Error("The CSV has an unfinished quoted field.");
  row.push(field);
  if (row.some((cell) => String(cell || "").trim() !== "")) matrix.push(row);
  if (matrix.length < 2) throw new Error("The CSV needs a header row and at least one transaction row.");

  const headers = uniqueHeaders(matrix[0]);
  const rows = matrix.slice(1).map((cells, index) => {
    const values = {};
    headers.forEach((header, columnIndex) => {
      values[header] = String(cells[columnIndex] ?? "").trim();
    });
    return { sourceRowNumber: index + 2, values };
  }).filter((item) => Object.values(item.values).some((value) => String(value || "").trim() !== ""));

  if (!rows.length) throw new Error("No transaction rows were found in the CSV.");
  return { headers, rows };
}

function findHeader(headers, candidates) {
  const normalized = headers.map((header) => ({ header, normalized: normalizeHeader(header) }));
  for (const candidate of candidates) {
    const exact = normalized.find((item) => item.normalized === candidate);
    if (exact) return exact.header;
  }
  for (const candidate of candidates) {
    const partial = normalized.find((item) => item.normalized.includes(candidate));
    if (partial) return partial.header;
  }
  return "";
}

export function guessBankCsvMapping(headers) {
  const date = findHeader(headers, ["transaction date", "posted date", "posting date", "date"]);
  const description = findHeader(headers, ["description", "transaction description", "details", "transaction", "name", "memo"]);
  const reference = findHeader(headers, ["transaction id", "reference number", "reference", "confirmation", "trace number", "trace"]);
  const amount = findHeader(headers, ["transaction amount", "amount"]);
  const debit = findHeader(headers, ["withdrawals", "withdrawal", "debit amount", "debit"]);
  const credit = findHeader(headers, ["deposits", "deposit", "credit amount", "credit"]);
  return {
    date,
    description,
    reference,
    mode: amount ? "signed" : "split",
    amount,
    debit,
    credit,
  };
}

function validDateParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseBankDate(value, format = "auto") {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return validDateParts(year, month, day) ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
  }

  const parts = raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})/);
  if (!parts) return null;
  let first = Number(parts[1]);
  let second = Number(parts[2]);
  let year = Number(parts[3]);
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  let month;
  let day;
  if (format === "dmy" || (format === "auto" && first > 12)) {
    day = first;
    month = second;
  } else {
    month = first;
    day = second;
  }
  return validDateParts(year, month, day) ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

export function parseBankMoney(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const negativeByParens = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[,$\s]/g, "").replace(/[()]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negativeByParens ? -Math.abs(parsed) : parsed;
}

const oppositeDirection = (direction) => direction === "credit" ? "debit" : "credit";

export function buildBankImportRows({ parsed, mapping, dateFormat = "auto", positiveDirection = "credit" }) {
  const get = (values, header) => header ? String(values?.[header] ?? "").trim() : "";
  return parsed.rows.map((source) => {
    const dateRaw = get(source.values, mapping.date);
    const description = get(source.values, mapping.description);
    const reference = get(source.values, mapping.reference);
    const occurredOn = parseBankDate(dateRaw, dateFormat);
    let direction = positiveDirection;
    let amount = null;
    let error = "";

    if (!mapping.date || !mapping.description) error = "Map the date and description columns.";
    if (!occurredOn && !error) error = "Invalid or unsupported date.";
    if (!description && !error) error = "Description is empty.";

    let amountRaw = "";
    let debitRaw = "";
    let creditRaw = "";
    if (mapping.mode === "signed") {
      amountRaw = get(source.values, mapping.amount);
      const signed = parseBankMoney(amountRaw);
      if (!mapping.amount && !error) error = "Map the amount column.";
      if ((signed == null || signed === 0) && !error) error = "Amount must be a non-zero number.";
      if (signed != null && signed !== 0) {
        direction = signed >= 0 ? positiveDirection : oppositeDirection(positiveDirection);
        amount = Math.abs(signed);
      }
    } else {
      debitRaw = get(source.values, mapping.debit);
      creditRaw = get(source.values, mapping.credit);
      const debit = parseBankMoney(debitRaw);
      const credit = parseBankMoney(creditRaw);
      const debitAmount = debit == null ? 0 : Math.abs(debit);
      const creditAmount = credit == null ? 0 : Math.abs(credit);
      if ((!mapping.debit || !mapping.credit) && !error) error = "Map both debit and credit columns.";
      if (debitAmount > 0 && creditAmount > 0 && !error) error = "Both debit and credit contain amounts.";
      if (debitAmount === 0 && creditAmount === 0 && !error) error = "No debit or credit amount found.";
      if (creditAmount > 0) {
        direction = "credit";
        amount = creditAmount;
      } else if (debitAmount > 0) {
        direction = "debit";
        amount = debitAmount;
      }
    }

    const valid = !error && occurredOn && Number.isFinite(amount) && amount > 0;
    return {
      clientKey: `csv-${source.sourceRowNumber}`,
      sourceRowNumber: source.sourceRowNumber,
      occurredOn: occurredOn || "",
      direction,
      amount: valid ? Number(amount).toFixed(2) : "",
      description,
      reference,
      sourceType: direction === "debit" ? "expense" : "other",
      sourceReference: "",
      expectedAmount: "",
      notes: "Imported from bank statement CSV",
      raw: {
        date: dateRaw,
        description,
        amount: mapping.mode === "signed" ? amountRaw : "",
        debit: mapping.mode === "split" ? debitRaw : "",
        credit: mapping.mode === "split" ? creditRaw : "",
        reference,
      },
      valid: Boolean(valid),
      error,
      selected: Boolean(valid),
      duplicate: false,
      fingerprint: "",
    };
  });
}

export async function sha256File(file) {
  if (!file?.arrayBuffer) throw new Error("Choose a valid CSV file.");
  if (!globalThis.crypto?.subtle) throw new Error("Secure file fingerprinting is unavailable in this browser.");
  const buffer = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
