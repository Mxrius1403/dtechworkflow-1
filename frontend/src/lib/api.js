import axios from "axios";

export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;
const api = axios.create({ baseURL: API_BASE });

export const fetchAllData = () => api.get("/data").then((r) => r.data);
export const fetchCatalog = () => api.get("/catalog").then((r) => r.data);
export const fetchTracking = (token) => api.get(`/tracking/${token}`).then((r) => r.data);
export const fetchClinicContact = (clinicId) => api.get(`/clinics/${clinicId}/contact`).then((r) => r.data);
