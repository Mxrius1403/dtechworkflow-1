/** Where an inbox message leads. Plain rules, no React. */

const TARGETS = {
  case: { collection: "cases", label: "case" },
  toothOrder: { collection: "toothOrders", label: "tooth order", path: (id) => `/tooth-orders#order-${id}` },
  materialOrder: { collection: "materialOrders", label: "material order", path: (id) => `/materials/requests#order-${id}` },
  route: { collection: "routes", label: "route", path: (id) => `/routes?open=${encodeURIComponent(id)}` },
};

/** { caseId } opens the case dialog in place; { path } navigates; null when the target is gone. */
export function inboxDestination(message, byId) {
  const target = TARGETS[message.target];
  if (!target || !byId?.[target.collection]?.[message.targetId]) return null;
  return message.target === "case" ? { caseId: message.targetId } : { path: target.path(message.targetId) };
}

export const inboxTargetLabel = (message) => TARGETS[message.target]?.label || "item";

export const unreadMessages = (messages) => messages.filter((m) => !m.read);
