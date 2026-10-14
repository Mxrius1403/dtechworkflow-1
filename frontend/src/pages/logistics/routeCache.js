import { useQueryClient } from "@tanstack/react-query";

const KEY = ["data"];

/**
 * Driver actions update the cached /data payload straight away, so the screen
 * never waits for a full reload. `refresh` reloads quietly in the background.
 */
export function useRouteCache() {
  const queryClient = useQueryClient();
  const patch = (collection, id, changes) => queryClient.setQueryData(KEY, (data) => data && {
    ...data,
    [collection]: data[collection].map((row) => (row.id === id ? { ...row, ...changes } : row)),
  });
  return {
    patchStop: (id, changes) => patch("stops", id, changes),
    patchRoute: (id, changes) => patch("routes", id, changes),
    // Stops a reload already on its way from overwriting a change the driver just made.
    hold: () => queryClient.cancelQueries({ queryKey: KEY, exact: true }),
    refresh: () => { queryClient.invalidateQueries({ queryKey: KEY, exact: true }); },
  };
}
