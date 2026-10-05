import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, Options } from "@/components/common/Field";
import { Panel } from "@/components/common/Panel";
import { CountPill } from "@/components/common/StatusBadge";
import { MATERIAL_SUPPLIERS } from "@/config/constants";
import { useData } from "@/context/DataContext";
import { useSession } from "@/context/SessionContext";
import { demoSave, notifyError } from "@/lib/notify";
import { MaterialCart } from "./MaterialCart";
import { MaterialGrid } from "./MaterialCard";
import { MaterialOrderList } from "./MaterialOrderList";
import { useFavourites } from "./useFavourites";

const EMPTY = { search: "", supplier: "all", group: "all" };
const searchText = (p) => [p.code, p.description, p.brand, p.group, p.subgroup, p.supplier, p.machine, p.pack, p.keywords].join(" ").toLowerCase();

function useCart() {
  const [cart, setCart] = useState([]);
  const add = (id) => setCart((c) => (c.some((x) => x.productId === id) ? c.map((x) => (x.productId === id ? { ...x, qty: x.qty + 1 } : x)) : [...c, { productId: id, qty: 1, notes: "" }]));
  const qty = (id, delta) => setCart((c) => c.map((x) => (x.productId === id ? { ...x, qty: Math.max(0, x.qty + delta) } : x)).filter((x) => x.qty > 0));
  const remove = (id) => setCart((c) => c.filter((x) => x.productId !== id));
  return { cart, add, qty, remove, clear: () => setCart([]) };
}

export function OrderTds() {
  const { catalog, materialOrders } = useData();
  const { user } = useSession();
  const products = catalog.materials;
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
    .filter((p) => (filters.supplier === "all" || p.supplier === filters.supplier) && (filters.group === "all" || p.group === filters.group) && words.every((w) => searchText(p).includes(w)))
    .sort((a, b) => (favourites.includes(b.id) - favourites.includes(a.id)) || a.group.localeCompare(b.group) || a.description.localeCompare(b.description));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const grid = { favourites, onFavourite: toggleFavourite, onAdd: cart.add };
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
          <Panel title="Find Products" description="Search by product name, code, brand, supplier or keywords such as cutter, acrylic, brush, lathe, micromotor, ortho or denture.">
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
              <Field label="Search"><Input value={form.search} onChange={set("search")} onKeyDown={(e) => e.key === "Enter" && setFilters(form)} placeholder="Example: cutter, acrylic, EDE/0664…" data-testid="material-search" /></Field>
              <Field label="Supplier"><NativeSelect value={form.supplier} onChange={set("supplier")} data-testid="material-supplier"><option value="all">All suppliers</option><Options items={MATERIAL_SUPPLIERS.map((s) => [s, s])} /></NativeSelect></Field>
              <Field label="Group"><NativeSelect value={form.group} onChange={set("group")} data-testid="material-group"><option value="all">All groups</option><Options items={[...new Set(products.map((p) => p.group))].map((g) => [g, g])} /></NativeSelect></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => setFilters(form)} data-testid="material-search-submit"><Search /> Search</Button>
              <Button variant="outline" onClick={() => { setForm(EMPTY); setFilters(EMPTY); }} data-testid="material-search-clear">Clear</Button>
              <CountPill testId="material-results-count">{shown.length} products</CountPill>
            </div>
          </Panel>
          {!filters.search && favourites.length > 0 && <MaterialGrid title="Favourites" products={favourites.map((id) => byId[id]).filter(Boolean)} testId="material-favourites" {...grid} />}
          {!filters.search && recent.length > 0 && <MaterialGrid title="Recently Ordered" products={recent} testId="material-recent" {...grid} />}
          <MaterialGrid title={filters.search ? "Search Results" : "All Products"} products={shown} testId="material-results" empty="No products found. Try fewer words or another code." {...grid} />
        </div>
        <MaterialCart cart={cart.cart} productsById={byId} notes={notes} onNotes={setNotes} onQty={cart.qty} onRemove={cart.remove} onSubmit={submit} onClear={cart.clear} />
      </div>
      <MaterialOrderList title="My Material Orders" orders={mine} />
    </>
  );
}
