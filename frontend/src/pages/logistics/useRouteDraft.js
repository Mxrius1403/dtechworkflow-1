import { useState } from "react";
import { today } from "@/lib/format";

/** The route being built: shared by "Ready for Delivery" (adds cases) and "Create Route" (publishes). */
export function useRouteDraft() {
  const [date, setDate] = useState(today);
  const [driverId, setDriverId] = useState("");
  const [collections, setCollections] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  return {
    date, setDate, driverId, setDriverId, collections, deliveries,
    addCollection: (item) => setCollections((list) => [...list, item]),
    removeCollection: (index) => setCollections((list) => list.filter((_, i) => i !== index)),
    addDeliveries: (items) => setDeliveries((list) => [...list, ...items]),
    removeDelivery: (index) => setDeliveries((list) => list.filter((_, i) => i !== index)),
    reset: () => {
      setCollections([]);
      setDeliveries([]);
      setDriverId("");
    },
  };
}
