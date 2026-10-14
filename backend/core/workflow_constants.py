"""Validated workflow vocabulary shared by production API endpoints."""

DEPARTMENTS = ("prosthesis", "ortho", "digital")
DEPARTMENT_LABELS = {
    "prosthesis": "Prosthesis",
    "ortho": "Ortho",
    "digital": "Digital",
}
# Always selectable, whatever service types Managers have set up.
NO_SERVICE_TYPE = "None"
ARCH_OPTIONS = ["Upper", "Lower", "Upper & Lower", "None"]
