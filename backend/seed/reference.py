"""Reference data for the demo seed: people, clinics and fixed vocabularies."""

SERVICE_TYPES = ["Repair", "Addition", "Bite", "Special Tray", "Finish", "Try In"]
ARCH_OPTIONS = ["Upper", "Lower", "Upper & Lower"]
OTHER_WORK_ACTIVITIES = [
    "Model Preparation", "Scanning", "Wire Preparation", "Appliance Preparation",
    "Machine Setup", "Cleaning / Maintenance", "Quality Control", "Training", "Other",
]
OVERDUE_REASONS = [
    "Waiting for clinic shade confirmation",
    "Acrylic batch curing took longer",
    "Technician reassigned to urgent repair",
    "Articulator out for calibration",
]

COMPANY = "Dentaltech Group"
LAB_EIRCODE = "D6W AD93"
MANAGER = ("MGR0001", "Ciarán Walsh")

# staff id, name, role, department, active
STAFF = [
    ("OWNER001", "Aoife Byrne", "owner", "", True),
    ("MGR0001", "Ciarán Walsh", "manager", "", True),
    ("MGR0002", "Sinéad Doyle", "manager", "", False),
    ("DEMO-TECH-1", "Demo Technician 1", "technician", "", True),
    ("DEMO-TECH-2", "Demo Technician 2", "technician", "", True),
    ("DEMO-TECH-3", "Demo Technician 3", "technician", "", True),
]

# driver id, name, active
DRIVERS = [
    ("D0001", "Seán Murphy", True),
    ("D0002", "Niamh Kelly", True),
    ("D0003", "Patrick O'Brien", True),
    ("D0004", "Fionn Ryan", False),
]

# id, name, address, eircode, active, (lat, lng), contact fields (email, phone, contact person, notes)
CLINICS = [
    ("C0001", "Rathmines Dental Care", "212 Lower Rathmines Road, Dublin 6", "D06 F7K2", True, (53.3226, -6.2654),
     ("reception@rathminesdental.example", "01 496 1200", "Clare Nolan", "Side door before 1pm")),
    ("C0002", "Smile Studio Ranelagh", "14 Ranelagh Village, Dublin 6", "D06 X2P9", True, (53.3262, -6.2564),
     ("hello@smilestudio.example", "01 497 3344", "Mark Delaney", "")),
    ("C0003", "Tallaght Family Dental", "Main Street, Tallaght, Dublin 24", "D24 K5N8", True, (53.2877, -6.3733),
     ("frontdesk@tallaghtdental.example", "01 451 8800", "Grace Moran", "Parking at rear")),
    ("C0004", "Clondalkin Dental Practice", "Orchard Road, Clondalkin, Dublin 22", "D22 H3T6", True, (53.3203, -6.3946),
     ("team@clondalkindental.example", "01 457 2211", "Declan Fox", "")),
    ("C0005", "Swords Dental Clinic", "Main Street, Swords, Co. Dublin", "K67 W8R4", True, (53.4597, -6.2181),
     ("info@swordsdental.example", "01 840 6655", "Aisling Dunne", "Ring on arrival")),
    ("C0006", "Blackrock Dental Suite", "Main Street, Blackrock, Co. Dublin", "A94 V2C7", True, (53.3015, -6.1778),
     ("care@blackrocksuite.example", "01 288 9090", "Paul Kenny", "")),
    ("C0007", "Lucan Smile Centre", "Main Street, Lucan, Co. Dublin", "K78 P6D3", True, (53.3574, -6.4486),
     ("", "01 628 1414", "Maeve Hogan", "No email on file")),
    ("C0008", "Phibsborough Dental", "North Circular Road, Dublin 7", "D07 Y4E1", False, (53.3610, -6.2735),
     ("office@phibsdental.example", "01 830 7070", "Eoin Barry", "Closed for renovation")),
]
