import { useSession } from "@/context/SessionContext";
import { ManagerHolidays } from "./ManagerHolidays";
import { TechnicianHolidays } from "./TechnicianHolidays";

export default function HolidaysPage() {
  const { user } = useSession();
  return user.isManager ? <ManagerHolidays /> : <TechnicianHolidays />;
}
