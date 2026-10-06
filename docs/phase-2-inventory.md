# Phase 2: Schreibaktionen im Frontend – Bestandsaufnahme

**Stand:** 2026-10-06
**Zweck:** Ausgangspunkt für die Umsetzung persistenter Schreibaktionen in Phase 2. Dieses Dokument beschreibt den untersuchten Codebestand; es definiert keine fachlichen Berechtigungen.

## Leseschlüssel und Aussagegrenzen

- **Bestätigte Fakten** beschreiben Verhalten, das im aktuellen Repository direkt belegt ist.
- **Fundstellen** verlinken auf die zuständigen Implementierungen. Die Zeilennummern beziehen sich auf den Stand dieser Bestandsaufnahme und können sich ändern.
- **UI-Gate** meint ausschließlich die im Frontend sichtbare Rollen-/Seitenbedingung. Das ist **keine** bestätigte Backend-Berechtigung.
- Wo eine fachliche Rolle naheliegt, aber nicht durch eine maßgebliche Berechtigungsspezifikation belegt ist, steht sie unter **Annahme – zu bestätigen**, nicht als Fakt.
- **Offene Fragen** müssen vor bzw. während der fachlichen/API-Entscheidung beantwortet werden. Bei widersprüchlichen oder fehlenden Angaben ist nicht aus den Demo-Personas auf echte Rechte zu schließen.

## Bestätigte Fakten zum aktuellen Stand

1. Die README bezeichnet Phase 1 als read-only Demo. Das Frontend lädt Daten per GET und `demoSave()` zeigt einen Demo-Hinweis, statt zu speichern: [Projekt-README](../README.md), [API-Client](../frontend/src/lib/api.js), [Demo-Schreib-Helfer](../frontend/src/lib/notify.js#L5).
2. Der Frontend-API-Client stellt GET-Aufrufe für Daten, Katalog, Tracking und Klinik-Kontakte bereit. Im untersuchten Backend gibt es keine POST-, PUT-, PATCH- oder DELETE-Route. Die vorhandenen API-Router sind [data.py](../backend/routers/data.py), [catalog.py](../backend/routers/catalog.py) und [logistics.py](../backend/routers/logistics.py).
3. Die `demoSave()`-Aufrufe umfassen die unten inventarisierten UI-Aktionen. Sie verändern die Backend-Daten nicht.
4. Der Seeder löscht und befüllt seine Collections erneut, wenn sich sein Marker ändert (unter anderem beim Wechsel des Tagesmarkers): [loader.py](../backend/seed/loader.py#L48). Eine persistente Schreib-API wäre deshalb ohne geänderte Seed-Strategie nicht ausreichend, um gespeicherte Änderungen dauerhaft zu erhalten.
5. Als Testdatei wurde [backend/tests/test_api.py](../backend/tests/test_api.py) gefunden. Sie testet GET-/Health-/Tracking-/Kontakt-Endpunkte; darin gibt es keine Mutationstests. Unter `frontend/src` wurden keine `*.test.*`- oder `*.spec.*`-Dateien gefunden.
6. Die Demo-Anmeldung speichert eine ausgewählte Persona in Browser-`localStorage`; sie ist keine Authentifizierung: [SessionContext.js](../frontend/src/context/SessionContext.js#L5).
7. Im Backend ist ein Klinik-Kontakt-GET vorhanden. Der Handler zeigt in der hier untersuchten Implementierung keine Auth-Abhängigkeit: [logistics.py](../backend/routers/logistics.py#L24). Die UI-Beschriftungen zu „protected“/„encrypted“ belegen keine aktuelle serverseitige Autorisierung oder Verschlüsselungsimplementierung.

## Schreibaktionen nach Arbeitsbereich

**Tests für die folgenden Aktionen:** keine spezifischen Frontend- oder Backend-Mutationstests im Repository gefunden. UI-`data-testid`-Attribute sind keine automatisierten Tests. Backend-GET-Tests sind keine Abdeckung der Schreibaktionen.

### Fälle, Produktion und Receiving

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Fall per Barcode starten oder zum Manager-Abschluss einreichen | `cases`: Statuswechsel Queue → Produktion oder Einreichung eines Produktionsabschlusses. Scanregeln wählen Fall und Ergebnis. | Techniker-Dashboard; Scanregeln beschränken u. a. Abteilung und fremde aktive Zuweisungen. Kein Backend-Recht belegt. | [TechnicianDashboard.jsx](../frontend/src/pages/dashboard/TechnicianDashboard.jsx#L18), [cases.js](../frontend/src/lib/cases.js#L100) |
| Fall neu aufnehmen oder Wiedereintritt terminieren | `cases`: Fallcode, Abteilung, Services, Kiefer, Produktionsdatum und bei Wiedereintritt Bezug zum früheren Fall. | `/receiving`: Manager oder Digital-Abteilung gemäß Navigation. Das ist nur ein Frontend-Gate. | [ReceivingPage.jsx](../frontend/src/pages/ReceivingPage.jsx#L42), [ReceivingWizard.jsx](../frontend/src/components/cases/ReceivingWizard.jsx#L15), [navigation.js](../frontend/src/config/navigation.js#L18) |
| Entfernten Fall wiederherstellen | `cases`: Wiederaufnahme in die aktive Queue. | Receiving-Seite; dieselbe Einschränkung wie beim Receiving. | [ReceivingPage.jsx](../frontend/src/pages/ReceivingPage.jsx#L51) |
| Fall korrigieren | `cases`: Abteilung, Status, Techniker-ID, operativer Zeitstempel und Überfälligkeitskennzeichen. | Fall-Dialog wird vom Manager-Dashboard geöffnet; URL-/UI-Gate Manager. Backend-Recht nicht vorhanden. | [CaseControlDialog.jsx](../frontend/src/components/cases/CaseControlDialog.jsx#L21), [CaseDialogsProvider.jsx](../frontend/src/components/cases/CaseDialogsProvider.jsx#L12), [navigation.js](../frontend/src/config/navigation.js#L5) |
| Fall aus aktiver Queue entfernen | `cases`: Status/Queue-Zugehörigkeit; UI-Text sagt, Historie und Reports sollten erhalten bleiben. | Im selben Fallverwaltungsdialog wie oben. | [CaseControlDialog.jsx](../frontend/src/components/cases/CaseControlDialog.jsx#L79) |
| Attention-Status und Notiz speichern | `cases`: `attentionStatus`, `attentionNote`. | UI-Schaltfläche ist beim eigenen Fall im Techniker-Dashboard vorhanden; Manager kann den Fall ebenfalls über Fallverwaltung öffnen. Keine maßgebliche Berechtigungsspezifikation gefunden. | [SmallCaseDialogs.jsx](../frontend/src/components/cases/SmallCaseDialogs.jsx#L27), [TechnicianDashboard.jsx](../frontend/src/pages/dashboard/TechnicianDashboard.jsx#L30) |
| Überfälligkeitsbegründung speichern; ggf. Abschluss einreichen | `cases`: `overdueReason` sowie bei `afterComplete` die Einreichung zur Manager-Prüfung. | Techniker-Dashboard bietet dies bei entsprechender Fallbedingung; Manager-Fallverwaltung hat ebenfalls einen Dialogzugang. | [SmallCaseDialogs.jsx](../frontend/src/components/cases/SmallCaseDialogs.jsx#L47), [TechnicianDashboard.jsx](../frontend/src/pages/dashboard/TechnicianDashboard.jsx#L30) |
| Techniker zuweisen und Fall in Produktion setzen | `cases`: `technicianId` und Produktionsstatus laut Dialogbeschriftung. | **Aktuell nicht als Nutzeraktion erreichbar:** `openAssign` existiert, aber es wurde kein Aufrufer gefunden. | [CaseDialogsProvider.jsx](../frontend/src/components/cases/CaseDialogsProvider.jsx#L17), [SmallCaseDialogs.jsx](../frontend/src/components/cases/SmallCaseDialogs.jsx#L65) |
| Abschluss bestätigen oder an Techniker zurückgeben | `cases`: Manager-Bestätigungs-/Review-Status; UI sagt, Bestätigung gibt Fälle für Reports und Auslieferung frei. | Completion Review wird laut Navigation Managern angezeigt. Backend-Recht fehlt. | [CompletionReviewPage.jsx](../frontend/src/pages/CompletionReviewPage.jsx#L11), [navigation.js](../frontend/src/config/navigation.js#L28) |

### Other Work

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Other Work starten oder beenden | `otherWork`: Aktivität, Techniker-ID, Start-/Endzeit; im UI als Bestandteil der Produktionsreports beschrieben. | `/other-work` wird laut Navigation für Nicht-Manager der Ortho-Abteilung angeboten. Kein Backend-Recht belegt. | [OtherWorkPage.jsx](../frontend/src/pages/OtherWorkPage.jsx#L13), [navigation.js](../frontend/src/config/navigation.js#L19) |

### Tooth- und Materialbestellungen

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Tooth Order absenden | `toothOrders`: Zähne, Gruppe, Shade, Menge, bestellende Person und Bestellzeit/-datum (aus dem UI-Kontext). | Technician-Seite; Manager hat eine separate Übersichtsseite. Kein Backend-Recht belegt. | [ToothOrderPage.jsx](../frontend/src/pages/tooth/ToothOrderPage.jsx#L25), [navigation.js](../frontend/src/config/navigation.js#L22) |
| Tooth Order löschen | `toothOrders`: ausgewählter Auftrag. | Manager-Übersichtsseite laut Navigation; Backend-Recht nicht vorhanden. | [ToothOrdersPage.jsx](../frontend/src/pages/tooth/ToothOrdersPage.jsx#L12), [navigation.js](../frontend/src/config/navigation.js#L23) |
| Materialbestellung absenden | `materialOrders`: Produkte, Mengen, Notizen sowie anfordernde Persona; die Ansicht filtert die eigenen Bestellungen. | Bestellseite für alle Rollen; Manager sieht laut Navigation „Material Order Requests“, Techniker/innen „Order TDS“. Das ist keine bestätigte Serverberechtigung. | [OrderTds.jsx](../frontend/src/pages/materials/OrderTds.jsx#L17), [navigation.js](../frontend/src/config/navigation.js#L24) |
| Materialstatus ändern | `materialOrders`: Übergänge `pending → ordered → received`. | Statusbuttons werden in der Materialanforderungsansicht für `manager` gerendert. | [MaterialOrderList.jsx](../frontend/src/pages/materials/MaterialOrderList.jsx#L12), [MaterialRequests.jsx](../frontend/src/pages/materials/MaterialRequests.jsx#L4) |
| Materialbestellung löschen | `materialOrders`: ausgewählter Auftrag. | Löschbutton erscheint in der gemeinsamen Auftragsliste. Manager- und Eigenbestellansicht verwenden dieselbe Komponente; ob Techniker/innen hier nur eigene Aufträge löschen dürfen, wird im Handler nicht geprüft. | [MaterialOrderList.jsx](../frontend/src/pages/materials/MaterialOrderList.jsx#L20), [OrderTds.jsx](../frontend/src/pages/materials/OrderTds.jsx#L25) |
| Favorit umschalten (**außerhalb von `demoSave()`**) | Browser-`localStorage`, pro User-ID benannter Schlüssel. Kein Backend-Datensatz. | Personalisierte UI-Einstellung; kein Rollen-Gate erkennbar. | [useFavourites.js](../frontend/src/pages/materials/useFavourites.js#L3) |

### Urlaub

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Urlaubsantrag stellen | `leaveRequests`: Zeitraum und berechnete Arbeitstage; UI-Prüfungen auf Überschneidung und Feiertage. | Nicht-Manager-Ansicht zeigt eigene Antragsform. Kein Backend-Recht belegt. | [TechnicianHolidays.jsx](../frontend/src/pages/holidays/TechnicianHolidays.jsx#L17), [HolidaysPage.jsx](../frontend/src/pages/holidays/HolidaysPage.jsx#L7) |
| Eigenen offenen Antrag stornieren | `leaveRequests`: Status des Pending-Antrags. | Stornieren wird bei den eigenen Pending-Anträgen gezeigt; im Callback wird die Eigentümerschaft nicht erneut geprüft. | [TechnicianHolidays.jsx](../frontend/src/pages/holidays/TechnicianHolidays.jsx#L62) |
| Antrag genehmigen | `leaveRequests`: Genehmigungsstatus; UI warnt bei Überschneidungen. | Manager-Ansicht. Die UI-Warnung ist keine atomare serverseitige Konfliktprüfung. | [ManagerHolidays.jsx](../frontend/src/pages/holidays/ManagerHolidays.jsx#L16), [HolidaysPage.jsx](../frontend/src/pages/holidays/HolidaysPage.jsx#L7) |
| Antrag ablehnen und optional begründen | `leaveRequests`: Ablehnungsstatus und Begründung. | Manager-Ansicht. | [RejectLeaveDialog.jsx](../frontend/src/pages/holidays/RejectLeaveDialog.jsx#L10) |
| Antrag aus Historie löschen | `leaveRequests`: ausgewählter Antrag. | Manager-Ansicht. | [ManagerHolidays.jsx](../frontend/src/pages/holidays/ManagerHolidays.jsx#L69) |

### Mitarbeitende, Fahrer/innen und Konto

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Techniker/in anlegen oder bearbeiten; aktivieren/deaktivieren | `users`: Name, Abteilung/Aktivstatus; Anlegen fragt zusätzlich E-Mail und temporäres Passwort ab. | Technikerübersicht laut Navigation Manager; Bearbeitungsdialog führt kein eigenes Rollen-Gate aus. | [TechniciansPage.jsx](../frontend/src/pages/technicians/TechniciansPage.jsx#L41), [StaffDialog.jsx](../frontend/src/pages/technicians/StaffDialog.jsx#L10) |
| Managerkonto anlegen/bearbeiten | `users`: Managerprofil; Dialog fragt bei Neuanlage E-Mail und temporäres Passwort ab. | Owner-Control-Seite ist im Frontend auf Owner beschränkt. Das ist kein serverseitiges Recht. | [OwnerControlPage.jsx](../frontend/src/pages/OwnerControlPage.jsx#L9), [navigation.js](../frontend/src/config/navigation.js#L16), [StaffDialog.jsx](../frontend/src/pages/technicians/StaffDialog.jsx#L10) |
| Fahrer/in anlegen oder bearbeiten | `drivers`: Profil/Aktivstatus; Dialog fragt bei Neuanlage E-Mail und temporäres Passwort ab. | Fahrer-Tab innerhalb des Manager-Logistics-Bereichs. Kein Backend-Recht belegt. | [DriversTab.jsx](../frontend/src/pages/logistics/DriversTab.jsx#L10), [LogisticsPage.jsx](../frontend/src/pages/logistics/LogisticsPage.jsx#L17) |
| Eigenen Kontonamen ändern | `users`: Name des dargestellten Managerkontos. | Account-Dialog wird für Manager/Owner in der Topbar angeboten. | [AccountDialog.jsx](../frontend/src/components/layout/AccountDialog.jsx#L9), [TopBar.jsx](../frontend/src/components/layout/TopBar.jsx#L18) |
| Passwort-Reset anfordern | Kein lokaler Datenbankdatensatz erkennbar; UI meldet einen gesendeten Reset. | Account-Dialog für Manager/Owner. Tatsächlicher Reset ist nicht implementiert. | [AccountDialog.jsx](../frontend/src/components/layout/AccountDialog.jsx#L27) |

### Reports

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Report speichern | `reports`: Report für ausgewählten Zeitraum; Reportdaten werden lokal berechnet. | Reports-Seite laut Navigation Manager. | [ReportPreview.jsx](../frontend/src/pages/reports/ReportPreview.jsx#L46), [ReportsPage.jsx](../frontend/src/pages/reports/ReportsPage.jsx#L16) |
| Gespeicherten Report löschen | `reports`: ausgewählter Report. | Saved Reports auf der Manager-Reports-Seite. | [SavedReports.jsx](../frontend/src/pages/reports/SavedReports.jsx#L13) |

### Logistics: Routen, Kliniken und Tracking

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Route veröffentlichen oder Besuche in bestehende Route einfügen | `routes`, `stops`, `routePlans`; Datum, Fahrer-ID, Lieferungen und Abholungen. | Logistics-Seite ist im Frontend für Manager vorgesehen. | [CreateRouteTab.jsx](../frontend/src/pages/logistics/CreateRouteTab.jsx#L55), [navigation.js](../frontend/src/config/navigation.js#L20) |
| Stopp zu Route hinzufügen | `stops` und Route; bei bestätigtem Fahrerplan soll ein neuer Stopp zur Platzierung übermittelt werden. | Manager-Logistics; UI erlaubt das für bestimmte aktive Routenstatus. | [AddStopDialog.jsx](../frontend/src/pages/logistics/AddStopDialog.jsx#L11), [RouteDialog.jsx](../frontend/src/pages/logistics/RouteDialog.jsx#L19) |
| Stopp an Fahrer/in übertragen | Stop-Zuordnung und ggf. Route-/Planungsdaten. UI-Text sagt, bestehender Tracking-Link soll erhalten bleiben. | Manager-Logistics; UI deaktiviert die Aktion für erledigte/angekommene Stops. | [TransferStopDialog.jsx](../frontend/src/pages/logistics/TransferStopDialog.jsx#L10), [RouteStopRow.jsx](../frontend/src/pages/logistics/RouteStopRow.jsx#L24) |
| Route löschen | Route sowie laut UI zu deaktivierende Klinik-Tracking-Links. | Manager-Logistics; UI erlaubt nur bestimmte Route-Status. | [RouteDialog.jsx](../frontend/src/pages/logistics/RouteDialog.jsx#L19) |
| Tracking-E-Mail einzeln oder gesammelt senden | `trackingEmails`/Versandstatus; Tracking-Link bzw. Token wird verwendet. | Manager-Logistics; Einzelversand erfordert laut UI Klinik-E-Mail, bestätigten Plan und noch keinen Versand. | [RouteStopRow.jsx](../frontend/src/pages/logistics/RouteStopRow.jsx#L8), [RouteDialog.jsx](../frontend/src/pages/logistics/RouteDialog.jsx#L25) |
| Klinik anlegen/bearbeiten | `clinics` und Klinik-Kontaktfelder (E-Mail, Telefon, Kontaktperson, Notizen). | Manager-Logistics. | [ClinicDialog.jsx](../frontend/src/pages/logistics/ClinicDialog.jsx#L11), [ClinicsTab.jsx](../frontend/src/pages/logistics/ClinicsTab.jsx#L14) |
| Klinik-CSV/JSON importieren | Mehrere Klinikdatensätze und Kontaktfelder; UI validiert Pflichtfelder/E-Mail und zählt Namens-/Eircode-Übereinstimmungen. | Manager-Logistics. | [ClinicImportDialog.jsx](../frontend/src/pages/logistics/ClinicImportDialog.jsx#L39), [csv.js](../frontend/src/lib/csv.js#L42) |

### Fahrer-App und Tracking

| Aktion | Betroffene Daten / im UI dargestellte Änderung | UI-Gate (nur sichtbare Bedingung) | Fundstellen |
|---|---|---|---|
| Fahrer-Routenplan bestätigen oder aktualisierten Plan bestätigen | `routePlans`: Reihenfolge/Bestätigung; UI sagt, vorhandene Trackinglinks würden aktualisiert. | Fahrerportal wählt eine Fahrer-Persona; eine echte Identitäts-/Zuweisungsprüfung ist nicht implementiert. | [useDriverFlow.js](../frontend/src/pages/driver/useDriverFlow.js#L49), [DriverMission.jsx](../frontend/src/pages/driver/DriverMission.jsx#L52) |
| Mission starten | `routes`: Startstatus; Trackingstatus soll sich ändern. | Fahrerportal; UI prüft bestimmte Routenstatus. | [useDriverFlow.js](../frontend/src/pages/driver/useDriverFlow.js#L60), [PublishedStages.jsx](../frontend/src/pages/driver/PublishedStages.jsx#L47) |
| Ankunft, Lieferung oder Abholung erfassen | `stops`: Ankunfts- und Besuchsstatus; Tracking wird laut UI aktualisiert. | Fahrerportal; UI verlangt gestartete Route und Ankunft vor Lieferung/Abholung. | [ActiveMission.jsx](../frontend/src/pages/driver/ActiveMission.jsx#L10) |
| Pause starten oder Route fortsetzen | `routes`: Pause-/Fortsetzungsstatus; Trackingstatus soll sich ändern. | Fahrerportal; abhängig vom dargestellten Routenstatus. | [ActiveMission.jsx](../frontend/src/pages/driver/ActiveMission.jsx#L51) |
| Fahrernachricht verwerfen | `notifications`: Lesestatus (`read` im Anzeige-Filter). | Nachricht wird im Fahrerportal nach `driverUid` gefiltert; der Callback selbst prüft keine Empfängerberechtigung. | [DriverMission.jsx](../frontend/src/pages/driver/DriverMission.jsx#L16) |
| Tagescheckliste und Reihenfolge bearbeiten (**nur lokal vor Bestätigung**) | React-State: geprüfte Lieferfälle und aktuelle Stop-Reihenfolge; Bestätigen ist eine separate persistente Aktion. | Fahrerportal. | [useDriverFlow.js](../frontend/src/pages/driver/useDriverFlow.js#L14), [PublishedStages.jsx](../frontend/src/pages/driver/PublishedStages.jsx#L13) |

## Weitere Schreib-/Exportpfade außerhalb von `demoSave()`

Diese Einträge sind bestätigte Browseraktionen, aber keine derzeitigen Backend-Mutationen:

| Pfad | Wirkung | Fundstellen |
|---|---|---|
| Demo-Anmelden/Abmelden | Persona in `localStorage` schreiben/entfernen; keine Authentifizierung. | [SessionContext.js](../frontend/src/context/SessionContext.js#L21) |
| Favoriten | Benutzerbezogene Favoritenliste in `localStorage` schreiben. | [useFavourites.js](../frontend/src/pages/materials/useFavourites.js#L18) |
| CSV-Vorlage herunterladen | Blob/URL und Browserdownload; keine Änderung an App-Daten. | [csv.js](../frontend/src/lib/csv.js#L61), [ClinicImportDialog.jsx](../frontend/src/pages/logistics/ClinicImportDialog.jsx#L61) |
| PDF/Druck | HTML in ein Iframe schreiben und Browser-Druckdialog öffnen; kein Server-PDF und keine Speicherung in der App. | [print.js](../frontend/src/lib/print.js#L12), Aufrufer u. a. in [ReportPreview.jsx](../frontend/src/pages/reports/ReportPreview.jsx#L48) |
| Entwürfe/Formulare | Receiving, Routenentwurf, Bestellkörbe und Fahrer-Checkliste/-Reihenfolge werden bis zum Absenden in React-State gehalten. | [useRouteDraft.js](../frontend/src/pages/logistics/useRouteDraft.js), [OrderTds.jsx](../frontend/src/pages/materials/OrderTds.jsx#L19), [useDriverFlow.js](../frontend/src/pages/driver/useDriverFlow.js#L14) |

## Annahmen – vor Umsetzung zu bestätigen

Die folgenden Punkte sind **keine bestätigten Berechtigungen oder Zusagen**. Sie sind lediglich aus Seitenaufteilung, Button-Sichtbarkeit oder Beschriftungen abgeleitete Arbeitshypothesen:

- **Annahme:** Receiving soll durch Manager und ggf. Digital-Techniker/innen nutzbar sein, da das Frontend genau diese Gruppen im Seiten-Gate nennt.
- **Annahme:** Fall-/Urlaubs-/Other-Work- und Bestellaktionen sollen entsprechend den aktuellen UI-Seitenbereichen eingeschränkt werden. Die UI kann jedoch manipuliert werden und ersetzt keine API-Autorisierung.
- **Annahme:** Fahreraktionen sollen nur für den angemeldeten, der betreffenden Route zugewiesenen Fahrer zulässig sein. Der aktuelle Demo-Login beweist keine Fahreridentität oder Zuweisung.
- **Annahme:** Persönliche Favoriten können browserlokal bleiben; die Existenz des `localStorage`-Pfads sagt nichts über die gewünschte Phase-2-Produktentscheidung aus.
- **Annahme:** Klinikkontaktfelder benötigen besondere Vertraulichkeit. UI-Texte versprechen Verschlüsselung, doch Verschlüsselungsverfahren, Schlüsselverwaltung und Zugriffspolitik sind im vorliegenden Schreibpfad nicht festgelegt.
- **Annahme:** „E-Mail gesendet“ benötigt einen echten Versanddienst; „Materialbestellung gesendet“ scheint eine interne Anfrage mit manuellem PDF-Export zu sein. Es wurde keine Anbieterintegration im Frontend-API-Client gefunden.

## Offene Fragen

1. Welche Identitätsquelle und welche Rollen-/Abteilungs-/Route-Zuweisungen gelten verbindlich? Wer darf welche Operation für fremde Datensätze ausführen?
2. Welche Fälle und Aktionen brauchen unveränderliche Audit-Einträge? Welche Löschungen müssen stattdessen Soft-Delete oder Statuswechsel sein?
3. Wie werden Demo-Seeds von produktiven/geänderten Datensätzen getrennt? Wann und unter welchen Bedingungen darf initiale Seed-Datenanlage laufen, ohne tägliche Änderungen zu überschreiben?
4. Welche Regeln sind serverseitig verbindlich für Fallstatus, Doppel-Scans, konkurrierende Zuweisungen, Feiertagsüberschneidungen, Materialstatus, Routenänderungen und Completion Review?
5. Sind Klinik-Kontaktfelder aktuell verschlüsselt? Welche Felder, Verschlüsselungsart, Schlüsselrotation, Zugriffsaudits und Antwort-Redaktion sind gefordert?
6. Welche Benachrichtigungen/Integrationen werden wirklich benötigt: Auth-Provider (Kontoanlage/Reset), E-Mail (Tracking), TDS (Bestellungen), Maps oder Standortdaten?
7. Welche Aktionen sollen nach erfolgreicher Mutation welche React-Query-Daten invalidieren bzw. zurückgeben? Wie werden Doppelsubmit, Wiederholungen und Netzwerkausfälle behandelt?
8. Dürfen Nutzer/innen Favoriten und Entwürfe geräteübergreifend synchronisieren, oder sollen diese absichtlich lokal bleiben?
9. Soll das derzeit nicht erreichbare Zuweisungs-Dialogfeature aktiviert oder entfernt werden?
10. Welche Aufbewahrungsfristen und fachlichen Folgen gelten für Löschen von Reports, Bestellungen, Urlaubsanträgen, Routen und Fällen?

## Implementierungsreihenfolge (Vorschlag, keine fachliche Entscheidung)

1. Offene Fragen zu Authentifizierung, Datenlebenszyklus/Seeding und Berechtigungsmatrix beantworten; vor produktiven Mutationen die tägliche Seed-Löschung absichern.
2. Backend-Mutationsgrundlagen und gezielte Tests einführen: authentifizierte Identität, Autorisierung je Operation/Objekt, Pydantic-Request-Validierung, Fehlerkonvention, Audit-Strategie und Persistenztests.
3. Falllebenszyklus umsetzen (Receiving/Wiedereintritt, Scan/Produktion, Attention/Überfälligkeit, Abschluss und Managerprüfung). Diese Daten speisen Reports und „Ready for Delivery“.
4. Weitere eigenständige Arbeitsabläufe umsetzen: Urlaub, Other Work, Tooth Orders, Material Orders und Reports.
5. Logistics in fachlichen Abhängigkeiten umsetzen: Klinikdaten samt Datenschutz, Import, Routen/Stops/Transfer/Löschung, danach Fahrermissionen und öffentliches Tracking.
6. Externe Integrationen (Auth-Provider, E-Mail und ggf. TDS) entsprechend den bestätigten Anforderungen ergänzen; nicht durch Erfolgsmeldungen ohne echten Dienst ersetzen.
7. Frontend-Mutationen über den API-Client anbinden und betroffene Queries aktualisieren; je Aktion Erfolg, Ablehnung, Validierungsfehler, Konkurrenz und Persistenz testen.
