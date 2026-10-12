import { ARCH_OPTIONS, SERVICE_TYPES } from "../config/constants";

const CLINIC_ALIASES = {
  clinicname: "name", name: "name", address: "address", eircode: "eircode", postcode: "eircode", email: "email",
  phone: "phone", telephone: "phone", contact: "contact", contactperson: "contact", notes: "notes", active: "active",
};
const INACTIVE = /^(false|no|0|inactive)$/i;

export const CLINIC_TEMPLATE_CSV =
  "name,address,eircode,email,phone,contact,notes,active\n";

function splitCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const pushRow = () => {
    row.push(cell);
    if (row.some((x) => String(x).trim())) rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i += 1; pushRow(); }
    else cell += ch;
  }
  pushRow();
  return rows;
}

export function parseClinicCsv(text) {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((x) => String(x).trim().toLowerCase().replace(/[ _-]+/g, ""));
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [CLINIC_ALIASES[h], String(values[i] ?? "").trim()]).filter(([k]) => k)));
}

export const normaliseClinicImport = (rows) => (Array.isArray(rows) ? rows : []).map((x) => ({
  name: String(x.name || x.clinicName || "").trim(),
  address: String(x.address || "").trim(),
  eircode: String(x.eircode || x.postcode || "").trim().toUpperCase(),
  email: String(x.email || "").trim().toLowerCase(),
  phone: String(x.phone || x.telephone || "").trim(),
  contact: String(x.contact || x.contactPerson || "").trim(),
  notes: String(x.notes || "").trim(),
  active: x.active !== false && !INACTIVE.test(String(x.active ?? "true")),
}));

export const CASE_TEMPLATE_CSV =
  "code,department,currentDueDate,serviceTypes,arch,status\nCASE-1001,prosthesis,2026-10-20,Repair;Finish,Upper,queue\n";
export const MAX_CASE_IMPORTS = 5000;
const CASE_ALIASES = {
  code: "code", casenumber: "code", case: "code", department: "department",
  currentduedate: "currentDueDate", duedate: "currentDueDate", productiondate: "currentDueDate", date: "currentDueDate",
  servicetypes: "serviceTypes", services: "serviceTypes", arch: "arch", status: "status",
};
const CASE_DEPARTMENTS = ["prosthesis", "ortho", "digital"];
const LEGACY_DEPARTMENTS = { denture: "prosthesis" };
const CASE_SERVICES = SERVICE_TYPES;
const CASE_ARCHES = ARCH_OPTIONS;
const matchOption = (options, value) => options.find((o) => o.toLowerCase() === String(value).trim().toLowerCase());
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function parseCaseCsv(text) {
  const rows = splitCsv(text);
  if (rows.length < 2) return [];
  const headers = rows.shift().map((x) => String(x).trim().toLowerCase().replace(/[ _-]+/g, ""));
  return rows.map((values) => Object.fromEntries(headers.map((h, i) => [CASE_ALIASES[h], String(values[i] ?? "").trim()]).filter(([k]) => k)));
}

const isFirebaseCase = (x) => x && typeof x === "object" && "code" in x
  && ("receivedDate" in x || "queueEnteredAt" in x);

/** Accepts an array, a single case object, or an object keyed by case id. */
export function casesFromJson(data) {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ("code" in data ? [data] : Object.values(data))
      : [];
  const firebaseExport = rows.some(isFirebaseCase);
  return rows
    .filter((x) => !firebaseExport || x?.deleted !== true)
    .map((x) => firebaseExport && isFirebaseCase(x) ? {
      ...x,
      currentDueDate: x.currentDueDate || x.scheduledDate || x.receivedDate,
      serviceTypes: x.serviceTypes?.length ? x.serviceTypes : ["None"],
      arch: x.arch || "None",
    } : x);
}

export const normaliseCaseImport = (rows) => (Array.isArray(rows) ? rows : []).map((x) => {
  const services = Array.isArray(x.serviceTypes) ? x.serviceTypes : String(x.serviceTypes || "").split(/[;|]/);
  const department = String(x.department || "").trim().toLowerCase();
  const history = x.history && typeof x.history === "object" ? x.history : undefined;
  return {
    code: String(x.code || "").trim(),
    department: LEGACY_DEPARTMENTS[department] || department,
    currentDueDate: String(x.currentDueDate || x.productionDate || x.scheduledDate || x.receivedDate || "").trim(),
    scheduledDate: x.scheduledDate ? String(x.scheduledDate).trim() : undefined,
    originalScheduledDate: x.originalScheduledDate ? String(x.originalScheduledDate).trim() : undefined,
    status: String(x.status || "").trim().toLowerCase() === "completed" ? "completed" : "queue",
    serviceTypes: services.map((s) => matchOption(CASE_SERVICES, s) || String(s).trim()).filter(Boolean),
    arch: matchOption(CASE_ARCHES, x.arch || "") || String(x.arch || "").trim(),
    attentionStatus: x.attentionStatus || undefined,
    attentionNote: x.attentionNote || undefined,
    receivedAt: x.receivedAt || undefined,
    createdAt: x.createdAt || undefined,
    updatedAt: x.updatedAt || undefined,
    missedScheduleDates: x.missedScheduleDates && typeof x.missedScheduleDates === "object" ? x.missedScheduleDates : undefined,
    history,
  };
});

export function validateCaseImport(rows) {
  const errors = [];
  const seen = new Set();
  rows.forEach((c, i) => {
    const row = `Row ${i + 2}`;
    if (!/^[A-Za-z0-9._/-]{1,64}$/.test(c.code)) errors.push(`${row}: invalid case number`);
    else if (seen.has(c.code.toLowerCase())) errors.push(`${row}: duplicate case number ${c.code}`);
    seen.add(c.code.toLowerCase());
    if (!CASE_DEPARTMENTS.includes(c.department)) errors.push(`${row}: department must be prosthesis, ortho or digital`);
    if (!isDate(c.currentDueDate)) errors.push(`${row}: currentDueDate must be YYYY-MM-DD`);
    if (!c.serviceTypes.length || c.serviceTypes.some((s) => !CASE_SERVICES.includes(s)) || (c.serviceTypes.includes("None") && c.serviceTypes.length > 1)) errors.push(`${row}: invalid service types`);
    if (!CASE_ARCHES.includes(c.arch)) errors.push(`${row}: arch must be Upper, Lower, Upper & Lower or None`);
  });
  if (!rows.length) errors.push("The file contains no case records");
  if (rows.length > MAX_CASE_IMPORTS) errors.push(`A maximum of ${MAX_CASE_IMPORTS} cases can be imported at once`);
  return errors;
}

export const isEmail = (value) => /^\S+@\S+\.\S+$/.test(value);

export function validateClinicImport(rows) {
  const errors = [];
  rows.forEach((c, i) => {
    if (!c.name || !c.address || !c.eircode) errors.push(`Row ${i + 2}: name, address and Eircode are required`);
    if (c.email && !isEmail(c.email)) errors.push(`Row ${i + 2}: invalid email`);
  });
  if (!rows.length) errors.push("The file contains no clinic records");
  return errors;
}

export function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
