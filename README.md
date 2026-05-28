# Siedlungsqualität im Profil

Eine Angular-Anwendung zur Visualisierung der Siedlungsqualität an beliebigen Standorten in der Schweiz und darüber hinaus.

## Features

- **Interaktive Karte:** Deck.gl WebGL-Visualisierung mit MapLibre-Basemap
- **Adresssuche:** Geocoding via Nominatim (OpenStreetMap) mit Autocomplete
- **Draggable Marker:** Standort per Drag & Drop verschieben
- **Radius-Visualisierung:** Einstellbarer Suchradius (100m – 3km) als Kreis auf der Karte
- **Infrastruktur-Metriken:** Anzeige von Restaurants, Supermärkten, ÖV-Haltestellen, Parks, Schulen und Apotheken im Umkreis
- **Responsive Sidebar:** Glassmorphism-Design mit ein-/ausklappbarer Sidebar

## Tech Stack

| Technologie | Version | Zweck |
|-------------|---------|-------|
| Angular | 21 | Frontend-Framework |
| Deck.gl | 9.x | WebGL-Kartenvisualisierung |
| MapLibre GL JS | 5.x | Basemap |
| TailwindCSS | 4.x | Utility-first CSS |
| TypeScript | 5.x | Typsicherheit |
| pnpm | 11.x | Package Manager |

## Schnellstart

```bash
cd frontend
pnpm install
pnpm start
```

Die Anwendung ist dann unter `http://localhost:4200` erreichbar.

## Projektstruktur

```
project/
├── agent.md                    # Entwicklungsregeln für AI-Assistenten
├── README.md
└── frontend/
    └── src/
        └── app/
            ├── components/
            │   ├── map/        # MapLibre Kartenkomponente
            │   ├── sidebar/    # Sidebar mit Metriken
            │   └── search-bar/ # Adresssuche
            ├── pages/
            │   └── main/       # Hauptseite
            ├── services/       # Business-Logik
            └── models/         # TypeScript Interfaces
```

## Entwicklung

Siehe [agent.md](./agent.md) für detaillierte Entwicklungsregeln und Konventionen.
