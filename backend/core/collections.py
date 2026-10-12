# API name -> MongoDB collection. Add a collection here to expose it under /api/data.
PUBLIC_COLLECTIONS = {
    "users": "users",
    "cases": "cases",
    "toothOrders": "tooth_orders",
    "materialOrders": "material_orders",
    "reports": "saved_reports",
    "drivers": "drivers",
    "clinics": "clinics",
    "suppliers": "suppliers",
    "routes": "routes",
    "stops": "stops",
    "routePlans": "route_plans",
    "notifications": "notifications",
}

# Stored but only reachable through dedicated endpoints.
SETTINGS = "settings"
CLINIC_CONTACTS = "clinic_contacts"
AUTH_USERS = "auth_users"
CASE_HISTORY = "case_history"
