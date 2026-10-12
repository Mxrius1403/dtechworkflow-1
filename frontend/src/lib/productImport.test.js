import { findExistingProductRefs, findProductWorksheet, normaliseProductImport } from "./productImport";

const suppliers = [{ id: "supplier-tds", name: "TDS" }];

test("finds the product sheet when a workbook contains multiple worksheets", () => {
  const worksheet = [["Product Code", "Description"], ["REF-1", "Product"]];

  expect(findProductWorksheet([
    { sheet: "Guide", data: [["Search term"], ["cutter"]] },
    { sheet: "Products", data: worksheet },
  ])).toBe(worksheet);
  expect(findProductWorksheet([{ sheet: "Guide", data: [["Search term"]] }])).toBeNull();
});

test("maps the product database columns to product fields", () => {
  const result = normaliseProductImport([
    ["Internal ID", "Supplier", "Brand", "Product Code", "Description", "Pack / Size", "Active"],
    ["DT0001", "TDS", "Erkodent", "EVA1.5/R2/025", "SOFT EVA tray", "25 pcs", "Yes"],
  ], suppliers);

  expect(result).toEqual({
    rows: [{
      refNo: "EVA1.5/R2/025",
      title: "SOFT EVA tray",
      producer: "Erkodent",
      supplierId: "supplier-tds",
      quantity: "25",
      unit: "pcs",
      measure: "",
    }],
    errors: [],
    skippedInactive: 0,
  });
});

test("accepts Ref No and explicit product fields, and skips inactive products", () => {
  const result = normaliseProductImport([
    ["Ref No.", "Title", "Producer", "Supplier", "Unit", "Quantity", "Measure", "Active"],
    ["REF-1", "Product", "Brand", "tds", "Bottle", "100", "ml", "Yes"],
    ["REF-2", "Old product", "Brand", "TDS", "Box", "1", "box", "No"],
  ], suppliers);

  expect(result.rows).toEqual([{
    refNo: "REF-1",
    title: "Product",
    producer: "Brand",
    supplierId: "supplier-tds",
    quantity: "100",
    unit: "Bottle",
    measure: "ml",
  }]);
  expect(result.skippedInactive).toBe(1);
  expect(result.errors).toEqual([]);
});

test("reports missing suppliers, duplicate refs, and existing product codes", () => {
  const result = normaliseProductImport([
    ["Product Code", "Description", "Brand", "Supplier", "Pack"],
    ["REF-1", "First", "Brand", "Unknown", "1 box"],
    ["REF-1", "Second", "Brand", "Unknown", "1 box"],
  ]);

  expect(result.errors).toEqual([
    'Row 2: supplier "Unknown" does not exist. Add it in Suppliers first.',
    'Row 3: supplier "Unknown" does not exist. Add it in Suppliers first.',
    "Row 3: duplicate product code REF-1.",
  ]);
  expect(findExistingProductRefs(
    [{ refNo: "REF-1" }, { refNo: "REF-2" }],
    [{ refNo: "ref-1" }],
  )).toEqual(["Row 2: product code REF-1 already exists."]);
});
