import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { fetchProducts } from "@/lib/api";
import { demoSave, notifyError } from "@/lib/notify";
import { MaterialCart } from "./MaterialCart";
import { MaterialGrid } from "./MaterialCard";
import { MaterialOrderList } from "./MaterialOrderList";
import { useFavourites } from "./useFavourites";

const EMPTY = { search: "", supplier: "all" };
const EMPTY_PRODUCTS = [];
const searchText = (product, supplier) =>
  [product.refNo, product.title, product.producer, supplier, product.unit, product.quantity, product.measure]
    .join(" ")
    .toLowerCase();

function useCart() {
  const [cart, setCart] = useState([]);
  const add = (id) => setCart((c) => (c.some((x) => x.productId === id) ? c.map((x) => (x.productId === id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { productId: id, qty: 1, notes: "" }]));
  const qty = (id, delta) => setCart((c) => c.map((x) => (x.productId === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x)).filter((x) => x.qty > 0));
  const remove = (id) => setCart((c) => c.filter((x) => x.productId !== id));
  return { cart, add, qty, remove, clear: () => setCart([]) };
}

export function OrderTds() {
  const { materialOrders, suppliers } = useData();
  const { user } = useSession();
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const products = productsQuery.data || EMPTY_PRODUCTS;
  const supplierNames = useMemo(
    () => Object.fromEntries(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const [form, setForm] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [notes, setNotes] = useState("");
  const [favourites, toggleFavourite] = useFavourites(user.id);
  const cart = useCart();
  const mine = materialOrders.filter((o) => o.requestedById === user.id);
  const recent = [...new Set([...mine].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).flatMap((o) => o.items.map((i) => i.productId)))].slice(0, 8).map((id) => byId[id]).filter(Boolean);
  const words = filters.search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = products
    .filter((product) => {
      const supplierName = supplierNames[product.supplierId] || "";
      return (filters.supplier === "all" || product.supplierId === filters.supplier)
        && words.every((word) => searchText(product, supplierName).includes(word));
    })
    .sort((a, b) => (favourites.includes(b.id) - favourites.includes(a.id))
      || a.title.localeCompare(b.title));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const grid = { favourites, suppliers: supplierNames, onFavourite: toggleFavourite, onAdd: cart.add };
  const submit = () => {
    if (!cart.cart.length) return notifyError("Add at least one product");
    demoSave("Material order sent");
    cart.clear();
    setNotes("");
  };

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 gap-5">
          <Panel title="Order TDS Products" description="Browse and search the products maintained by Product Management.">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
              <Field label="Search products"><Input value={form.search} onChange={set("search")} onKeyDown={(e) => e.key === "Enter" && setFilters(form)} placeholder="Search by reference number, title, producer or pack…" data-testid="material-search" /></Field>
              <Field label="Supplier"><NativeSelect value={form.supplier} onChange={set("supplier")} data-testid="material-supplier"><option value="all">All suppliers</option><Options items={[...new Set(products.map((product) => product.supplierId))].map((id) => [id, supplierNames[id] || "Supplier unavailable"])} /></NativeSelect></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => setFilters(form)} data-testid="material-search-submit"><Search /> Search</Button>
              <Button variant="outline" onClick={() => { setForm(EMPTY); setFilters(EMPTY); }} data-testid="material-search-clear">Clear</Button>
              <CountPill testId="material-results-count">{shown.length} products</CountPill>
            </div>
          </Panel>
          {productsQuery.isLoading ? (
            <Panel title="Products"><Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-secondary" /></Panel>
          ) : productsQuery.isError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm" role="alert">
              <span>Could not load products.</span>
              <Button variant="outline" size="sm" onClick={() => productsQuery.refetch()}>Retry</Button>
            </div>
          ) : (
            <>
              {!filters.search && favourites.length > 0 && <MaterialGrid title="Favourites" products={favourites.map((id) => byId[id]).filter(Boolean)} testId="material-favourites" {...grid} />}
              {!filters.search && recent.length > 0 && <MaterialGrid title="Recently Ordered" products={recent} testId="material-recent" {...grid} />}
              <MaterialGrid title={filters.search ? "Search Results" : "All Products"} products={shown} testId="material-results" empty="No products available. Add products in Product Management." {...grid} />
            </>
          )}
        </div>
        <MaterialCart cart={cart.cart} productsById={byId} suppliers={supplierNames} notes={notes} onNotes={setNotes} onQty={cart.qty} onRemove={cart.remove} onSubmit={submit} onClear={cart.clear} />
      </div>
      <MaterialOrderList title="My Material Orders" orders={mine} />
    </>
  );
}
