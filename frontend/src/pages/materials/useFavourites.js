import { useCallback, useState } from "react";

const keyFor = (userId) => `dt-material-favourites-${userId || "guest"}`;
const read = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId)) || "[]");
  } catch {
    return [];
  }
};

/** Favourite products are a personal preference kept in this browser (same as the original app). */
export function useFavourites(userId) {
  const [ids, setIds] = useState(() => read(userId));
  const toggle = useCallback((id) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(keyFor(userId), JSON.stringify(next));
      return next;
    });
  }, [userId]);
  return [ids, toggle];
}
