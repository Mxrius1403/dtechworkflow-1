import { useQuery } from "@tanstack/react-query";
import { fetchServiceTypes } from "@/lib/api";
import { serviceTypesByDepartment } from "@/lib/serviceTypes";

export const SERVICE_TYPES_KEY = ["service-types"];

/** Service types Managers have set up, as a list and grouped by department. */
export function useServiceTypes() {
  // Always refreshed when a screen opens, so Receiving sees changes made on another device.
  const query = useQuery({ queryKey: SERVICE_TYPES_KEY, queryFn: fetchServiceTypes, staleTime: 0 });
  return { ...query, byDepartment: serviceTypesByDepartment(query.data) };
}
