import { Injectable, signal, computed } from '@angular/core';
import { MetricsService } from './metrics.service';
import { LocationData, LocationMetrics, PoiPoint, PoiCategory, PoiCategoryConfig, POI_CATEGORIES } from '../models/metrics.model';

export type AreaMode = 'radius' | 'polygon';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private readonly _lat = signal<number>(47.3769); // Default: Zürich
  private readonly _lng = signal<number>(8.5417);
  private readonly _radius = signal<number>(500); // Default: 500m
  private readonly _address = signal<string>('');
  private readonly _areaMode = signal<AreaMode>('radius');
  private readonly _polygon = signal<[number, number][]>([]); // [lng, lat] pairs
  private readonly _isDrawing = signal<boolean>(false);
  private readonly _categoryVisibility = signal<Record<PoiCategory, boolean>>({
    restaurants: true,
    supermarkets: true,
    publicTransport: true,
    parks: true,
    schools: true,
    pharmacies: true,
  });

  readonly lat = this._lat.asReadonly();
  readonly lng = this._lng.asReadonly();
  readonly radius = this._radius.asReadonly();
  readonly address = this._address.asReadonly();
  readonly areaMode = this._areaMode.asReadonly();
  readonly polygon = this._polygon.asReadonly();
  readonly isDrawing = this._isDrawing.asReadonly();
  readonly categoryVisibility = this._categoryVisibility.asReadonly();

  readonly categories: PoiCategoryConfig[] = POI_CATEGORIES;

  // Effective radius: either the set radius or calculated from polygon
  readonly effectiveRadius = computed<number>(() => {
    if (this._areaMode() === 'polygon' && this._polygon().length >= 3) {
      return this.calculatePolygonRadius();
    }
    return this._radius();
  });

  // Effective center: either the marker or polygon centroid
  readonly effectiveCenter = computed<{ lat: number; lng: number }>(() => {
    if (this._areaMode() === 'polygon' && this._polygon().length >= 3) {
      const centroid = this.calculatePolygonCentroid();
      return { lat: centroid[1], lng: centroid[0] };
    }
    return { lat: this._lat(), lng: this._lng() };
  });

  readonly metrics = computed<LocationMetrics>(() => {
    const center = this.effectiveCenter();
    const radius = this.effectiveRadius();
    return this.metricsService.getMetrics(center.lat, center.lng, radius);
  });

  readonly poiPoints = computed<PoiPoint[]>(() => {
    const center = this.effectiveCenter();
    const radius = this.effectiveRadius();
    return this.metricsService.getPoiPoints(center.lat, center.lng, radius);
  });

  readonly visiblePoiPoints = computed<PoiPoint[]>(() => {
    const visibility = this._categoryVisibility();
    return this.poiPoints().filter(p => visibility[p.category]);
  });

  readonly locationData = computed<LocationData>(() => ({
    lat: this._lat(),
    lng: this._lng(),
    radius: this._radius(),
    address: this._address(),
    metrics: this.metrics()
  }));

  constructor(private metricsService: MetricsService) {}

  setLocation(lat: number, lng: number): void {
    this._lat.set(lat);
    this._lng.set(lng);
  }

  setRadius(radius: number): void {
    this._radius.set(radius);
  }

  setAddress(address: string): void {
    this._address.set(address);
  }

  updateLocation(lat: number, lng: number, address?: string): void {
    this._lat.set(lat);
    this._lng.set(lng);
    if (address) {
      this._address.set(address);
    }
  }

  // Polygon drawing
  setAreaMode(mode: AreaMode): void {
    this._areaMode.set(mode);
    if (mode === 'radius') {
      this._polygon.set([]);
      this._isDrawing.set(false);
    }
  }

  startDrawing(): void {
    this._isDrawing.set(true);
    this._polygon.set([]);
    this._areaMode.set('polygon');
  }

  addPolygonPoint(lng: number, lat: number): void {
    const current = this._polygon();
    this._polygon.set([...current, [lng, lat]]);
  }

  finishDrawing(): void {
    this._isDrawing.set(false);
  }

  clearPolygon(): void {
    this._polygon.set([]);
    this._isDrawing.set(false);
    this._areaMode.set('radius');
  }

  private calculatePolygonCentroid(): [number, number] {
    const points = this._polygon();
    if (points.length === 0) return [this._lng(), this._lat()];

    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of points) {
      sumLng += lng;
      sumLat += lat;
    }
    return [sumLng / points.length, sumLat / points.length];
  }

  private calculatePolygonRadius(): number {
    const points = this._polygon();
    if (points.length < 3) return this._radius();

    const centroid = this.calculatePolygonCentroid();
    let maxDist = 0;

    for (const [lng, lat] of points) {
      const dLat = (lat - centroid[1]) * 111320;
      const dLng = (lng - centroid[0]) * 111320 * Math.cos((centroid[1] * Math.PI) / 180);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);
      maxDist = Math.max(maxDist, dist);
    }

    return Math.round(maxDist);
  }

  toggleCategory(category: PoiCategory): void {
    const current = this._categoryVisibility();
    this._categoryVisibility.set({
      ...current,
      [category]: !current[category]
    });
  }

  isCategoryVisible(category: PoiCategory): boolean {
    return this._categoryVisibility()[category];
  }
}
