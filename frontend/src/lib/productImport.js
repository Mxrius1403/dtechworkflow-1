const PRODUCT_ALIASES = {
  refno: "refNo",
  reference: "refNo",
  referenceno: "refNo",
  productcode: "refNo",
  code: "refNo",
  title: "title",
  description: "title",
  productdescription: "title",
  producer: "producer",
  brand: "producer",
  manufacturer: "producer",
  supplier: "supplier",
  supplierid: "supplierId",
  unit: "unit",
  quantity: "quantity",
  measure: "measure",
  pack: "pack",
  packsize: "pack",
  size: "pack",
  useequipment: "useEquipment",
  active: "active",
};

const normaliseHeader = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (value) => String(value ?? "").trim();
const INACTIVE_VALUES = new Set(["no", "false", "0", "inactive"]);
export const MAX_PRODUCT_IMPORTS = 1000;

export function findProductWorksheet(sheets) {
  return sheets.find((sheet) => (
    Array.isArray(sheet.data)
      && sheet.data.length > 0
      && sheet.data[0].some((header) => PRODUCT_ALIASES[normaliseHeader(header)] === "refNo")
  ))?.data || null;
}

function packFields(pack) {
  const value = text(pack);
  const amount = value.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)?)\s+(.+)$/);
  if (amount) return { quantity: amount[1], unit: amount[2], measure: "" };
  return { quantity: value ? "1" : "", unit: value, measure: "" };
}

export function normaliseProductImport(worksheet, suppliers = []) {
  if (!Array.isArray(worksheet) || worksheet.length < 2) {
    return { rows: [], errors: ["The worksheet contains no product records."], skippedInactive: 0 };
  }

  const headers = worksheet[0].map((header) => PRODUCT_ALIASES[normaliseHeader(header)] || null);
  const hasPack = headers.includes("pack");
  const supplierByName = new Map(
    suppliers.map((supplier) => [text(supplier.name).toLowerCase(), supplier.id]),
  );
  const seenRefs = new Set();
  const errors = [];
  let skippedInactive = 0;
  const rows = [];

  worksheet.slice(1).forEach((cells, index) => {
    const values = Object.fromEntries(
      headers.map((header, column) => [header, text(cells?.[column])]).filter(([key]) => key),
    );
    if (Object.values(values).every((value) => !value)) return;
    if (values.active && INACTIVE_VALUES.has(values.active.toLowerCase())) {
      skippedInactive += 1;
      return;
    }

    const packed = hasPack ? packFields(values.pack) : { quantity: "", unit: "", measure: "" };
    const supplierName = values.supplier || "";
    const product = {
      refNo: values.refNo || "",
      title: values.title || "",
      producer: values.producer || "",
      supplierId: values.supplierId || supplierByName.get(supplierName.toLowerCase()) || "",
      quantity: values.quantity || packed.quantity,
      unit: values.unit || packed.unit,
      measure: values.measure || packed.measure,
    };
    const rowNumber = index + 2;
    const missing = ["refNo", "title", "producer", "supplierId", "quantity", "unit"]
      .filter((field) => field !== "supplierId" || !supplierName)
      .filter((field) => !product[field]);
    if (missing.length) errors.push(`Row ${rowNumber}: missing ${missing.join(", ")}.`);
    if (supplierName && !product.supplierId) {
      errors.push(`Row ${rowNumber}: supplier "${supplierName}" does not exist. Add it in Suppliers first.`);
    }
    const refKey = product.refNo.toLowerCase();
    if (refKey && seenRefs.has(refKey)) errors.push(`Row ${rowNumber}: duplicate product code ${product.refNo}.`);
    if (refKey) seenRefs.add(refKey);
    rows.push(product);
  });

  if (!rows.length) errors.push("The file contains no active product records.");
  if (rows.length > MAX_PRODUCT_IMPORTS) {
    errors.push(`A maximum of ${MAX_PRODUCT_IMPORTS} products can be imported at once.`);
  }
  return { rows, errors, skippedInactive };
}

export function findExistingProductRefs(products, existingProducts) {
  const existing = new Set(existingProducts.map((product) => text(product.refNo).toLowerCase()));
  return products.flatMap((product, index) => (
    existing.has(text(product.refNo).toLowerCase())
      ? [`Row ${index + 2}: product code ${product.refNo} already exists.`]
      : []
  ));
}
