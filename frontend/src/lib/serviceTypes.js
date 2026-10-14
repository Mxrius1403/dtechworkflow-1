import { NO_SERVICE_TYPE } from "../config/constants";
import { DEPARTMENTS } from "./cases";

export const SERVICE_TYPE_NAME_LIMIT = 60;

/** Same comparison as the server: case and extra spaces do not make a name different. */
export const serviceTypeKey = (name) => String(name).trim().replace(/\s+/g, " ").toLowerCase();

/** { prosthesis: [names], ortho: [...], digital: [...] } in the order Managers added them. */
export const serviceTypesByDepartment = (serviceTypes = []) => Object.fromEntries(
  DEPARTMENTS.map((department) => [
    department,
    serviceTypes.filter((t) => t.department === department).map((t) => t.name),
  ]),
);

/** What can be chosen for a case: the department's service types, then None, which is always available. */
export const serviceTypeOptions = (byDepartment, department) => [...(byDepartment?.[department] || []), NO_SERVICE_TYPE];

/** The option spelled as set up, or undefined when `name` is not an option. */
export const matchServiceType = (options, name) => options.find((o) => serviceTypeKey(o) === serviceTypeKey(name));
