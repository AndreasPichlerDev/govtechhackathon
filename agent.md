# Agent Rules – Siedlungsqualität im Profil

## Projektübersicht

Dieses Projekt ist eine Angular-Anwendung zur Visualisierung der Siedlungsqualität an beliebigen Standorten. Nutzer können Adressen suchen, einen Radius einstellen und sehen, welche Infrastruktur (Restaurants, Supermärkte, ÖV etc.) im Umkreis verfügbar ist.

## Technologie-Stack

- **Framework:** Angular 21 (Standalone-Komponenten, neuer Control Flow mit `@if`, `@for`, `@switch`)
- **Styling:** TailwindCSS v4 + SCSS für komponentenspezifische Styles
- **Karten:** Deck.gl (WebGL-basierte Visualisierung) + MapLibre GL JS als Basemap (Open Source, kein API Key erforderlich)
- **Geocoding:** Nominatim (OpenStreetMap) für Adresssuche
- **State Management:** Angular Signals (kein NgRx oder externe State-Library)
- **Package Manager:** pnpm

## Coding-Regeln

### Angular-spezifisch

1. **Standalone-Komponenten:** Alle Komponenten MÜSSEN `standalone: true` verwenden. Keine NgModules.
2. **Neuer Control Flow:** Verwende `@if`, `@for`, `@switch` statt `*ngIf`, `*ngFor`, `*ngSwitch`.
3. **Signals:** Verwende Angular Signals für reaktiven State. Keine BehaviorSubjects für lokalen State.
4. **Inject-Funktion:** Bevorzuge `inject()` statt Constructor Injection.
5. **Lazy Loading:** Routes MÜSSEN mit `loadComponent` lazy geladen werden.
6. **Keine Barrel-Files:** Keine `index.ts` Barrel-Exports. Direkte Imports verwenden.

### Dateistruktur

```
frontend/src/app/
├── components/       # Wiederverwendbare UI-Komponenten
├── pages/            # Route-Komponenten (eine pro Route)
├── services/         # Business-Logik und API-Calls
├── models/           # TypeScript Interfaces und Types
└── utils/            # Hilfsfunktionen
```

### Naming Conventions

- Komponenten: `kebab-case` für Dateien, `PascalCase` für Klassen
- Services: `*.service.ts`
- Models: `*.model.ts`
- Dateien: `component-name.component.ts`, `component-name.component.html`, `component-name.component.scss`

### Styling

1. **TailwindCSS** für Layout und generische Styles.
2. **SCSS** für komponentenspezifische, komplexe Styles.
3. **Kein globales CSS** ausser in `styles.scss`.
4. **Design-System:** Indigo (#6366f1) als Primärfarbe, Slate-Grautöne für Text.
5. **Glassmorphism** für schwebende UI-Elemente (Sidebar, Suchleiste).

### Code-Qualität

1. **TypeScript strict mode** ist aktiviert. Keine `any` Types.
2. **Keine Magic Numbers:** Konstanten auslagern.
3. **Kommentare:** JSDoc für öffentliche Methoden in Services.
4. **Error Handling:** Alle API-Calls müssen Fehler abfangen.
5. **Accessibility:** ARIA-Labels für interaktive Elemente.

### Git-Workflow

1. **Feature Branches:** Neue Features in separaten Branches entwickeln.
2. **Commit Messages:** Konventionelle Commits (feat:, fix:, refactor:, docs:, style:, chore:).
3. **Keine Secrets:** Keine API-Keys oder Credentials im Repository.

## Backend-Integration (Zukunft)

Der `MetricsService` ist aktuell mit Mock-Daten implementiert. Für die echte Backend-Anbindung:

1. Ersetze die Mock-Logik durch HTTP-Calls (`HttpClient`).
2. Verwende Environment-Variablen für die Backend-URL.
3. Implementiere Error-Handling und Loading-States.
4. Erwartetes API-Format:

```typescript
// GET /api/metrics?lat={lat}&lng={lng}&radius={radius}
interface MetricsResponse {
  restaurants: number;
  supermarkets: number;
  publicTransport: number;
  parks: number;
  schools: number;
  pharmacies: number;
}
```

## Erweiterungsmöglichkeiten

- Heatmap-Layer für Siedlungsqualität
- Vergleich mehrerer Standorte
- Detailansicht pro Kategorie (Liste der einzelnen POIs)
- Benutzerdefinierte Gewichtung der Kategorien
- Export als PDF-Report
