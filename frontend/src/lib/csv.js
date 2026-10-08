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
