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

// Multi-Location Management
export interface ManagedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  color: string; // hex color
  metrics: LocationMetrics;
  isActive: boolean; // currently selected/focused
}

export const LOCATION_COLORS: string[] = [
  '#6366f1', // Indigo
  '#f97316', // Orange
  '#22c55e', // Green
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308', // Yellow
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
];

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
