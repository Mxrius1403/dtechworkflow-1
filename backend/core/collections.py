# API name -> MongoDB collection. Add a collection here to expose it under /api/data.
PUBLIC_COLLECTIONS = {
    "users": "users",
    "cases": "cases",
    "toothOrders": "tooth_orders",
    "materialOrders": "material_orders",
    "reports": "saved_reports",
    "leaveRequests": "leave_requests",
    "drivers": "drivers",
    "clinics": "clinics",
    "suppliers": "suppliers",
    "routes": "routes",
    "stops": "stops",
    "routePlans": "route_plans",
    "notifications": "notifications",
    "trackingEmails": "tracking_emails",
}

# Stored but only reachable through dedicated endpoints.
SETTINGS = "settings"
PUBLIC_TRACKING = "public_tracking"
CLINIC_CONTACTS = "clinic_contacts"
SEED_META = "seed_meta"
AUTH_USERS = "auth_users"
