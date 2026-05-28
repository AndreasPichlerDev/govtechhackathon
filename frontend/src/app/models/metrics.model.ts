export interface LocationMetrics {
  restaurants: number;
  supermarkets: number;
  publicTransport: number;
  parks: number;
  schools: number;
  pharmacies: number;
}

export interface PoiPoint {
  position: [number, number];
  category: PoiCategory;
  name: string;
  distance?: number; // distance from center in meters
}

export type PoiCategory = 'restaurants' | 'supermarkets' | 'publicTransport' | 'parks' | 'schools' | 'pharmacies';

export interface PoiCategoryConfig {
  key: PoiCategory;
  label: string;
  icon: string;
  color: [number, number, number, number];
  visible: boolean;
}

export const POI_CATEGORIES: PoiCategoryConfig[] = [
  { key: 'restaurants', label: 'Restaurants', icon: '🍽️', color: [239, 68, 68, 220], visible: true },
  { key: 'supermarkets', label: 'Supermärkte', icon: '🛒', color: [34, 197, 94, 220], visible: true },
  { key: 'publicTransport', label: 'ÖV-Haltestellen', icon: '🚌', color: [59, 130, 246, 220], visible: true },
  { key: 'parks', label: 'Parks & Grünflächen', icon: '🌳', color: [16, 185, 129, 220], visible: true },
  { key: 'schools', label: 'Schulen', icon: '🏫', color: [245, 158, 11, 220], visible: true },
  { key: 'pharmacies', label: 'Apotheken', icon: '💊', color: [168, 85, 247, 220], visible: true },
];

export interface LocationData {
  lat: number;
  lng: number;
  radius: number;
  address?: string;
  metrics: LocationMetrics;
}

// Wohnort-Finder types
export interface CategoryPreference {
  category: PoiCategory;
  weight: number; // 0-100
  enabled: boolean;
}

export interface LocationScore {
  lat: number;
  lng: number;
  address: string;
  totalScore: number; // 0-100
  categoryScores: Record<PoiCategory, number>;
}
