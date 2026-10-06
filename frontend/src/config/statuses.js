// One place for every status colour. Change a tone here and every badge in the app follows.
export const TONES = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200",
  emerald: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
  sky: "bg-sky-50 text-sky-800 border-sky-200",
  zinc: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export const STATUS = {
  case: { queue: ["In Queue", "slate"], production: ["In Production", "cyan"], completed: ["Completed", "emerald"], removed: ["Removed", "zinc"] },
  route: { published: ["Published", "slate"], started: ["Started", "cyan"], break: ["On Break", "amber"], completed: ["Completed", "emerald"], cancelled: ["Cancelled", "zinc"] },
  stop: { pending: ["Pending", "slate"], arrived: ["Arrived", "cyan"], completed: ["Completed", "emerald"] },
  order: { pending: ["Pending", "amber"], ordered: ["Ordered", "sky"], received: ["Received", "emerald"] },
  leave: { pending: ["Pending", "amber"], approved: ["Approved", "emerald"], rejected: ["Rejected", "rose"], cancelled: ["Cancelled", "zinc"] },
  account: { active: ["Active", "emerald"], inactive: ["Inactive", "zinc"] },
  flag: {
    overdue: ["Overdue", "rose"], on_hold: ["On Hold", "amber"], need_information: ["Need Information", "indigo"],
    awaiting: ["Awaiting Confirmation", "sky"], reason: ["Reason Required", "rose"], ontime: ["On Time", "emerald"],
    urgent: ["New Urgent Stop", "rose"], protected: ["Auth protected", "emerald"], encrypted: ["Email encrypted", "emerald"],
  },
};

export const DEPARTMENT_STYLE = {
  prosthesis: { dot: "bg-[#0097a7]", text: "text-[#007784]", soft: "bg-teal-50", ring: "border-l-[#0097a7]", initial: "P" },
  ortho: { dot: "bg-indigo-500", text: "text-indigo-700", soft: "bg-indigo-50", ring: "border-l-indigo-500", initial: "O" },
  digital: { dot: "bg-sky-600", text: "text-sky-700", soft: "bg-sky-50", ring: "border-l-sky-600", initial: "DG" },
};

export const INSIGHT_TONE = {
  good: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  warn: "border-amber-200 bg-amber-50/70 text-amber-900",
  "": "border-slate-200 bg-slate-50 text-slate-700",
};
