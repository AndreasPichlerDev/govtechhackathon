import { Injectable, signal, computed } from '@angular/core';
import { ManagedLocation, LocationMetrics, LOCATION_COLORS } from '../models/metrics.model';
import { MetricsService } from './metrics.service';

@Injectable({
  providedIn: 'root'
})
export class LocationManagerService {
  private readonly _locations = signal<ManagedLocation[]>([]);
  private readonly _activeLocationId = signal<string | null>(null);
  private colorIndex = 0;

  readonly locations = this._locations.asReadonly();
  readonly activeLocationId = this._activeLocationId.asReadonly();

  readonly activeLocation = computed<ManagedLocation | null>(() => {
    const id = this._activeLocationId();
    if (!id) return null;
    return this._locations().find(l => l.id === id) || null;
  });

  constructor(private metricsService: MetricsService) {}

  addLocation(lat: number, lng: number, name?: string, radius?: number): ManagedLocation {
    const id = this.generateId();
    const color = LOCATION_COLORS[this.colorIndex % LOCATION_COLORS.length];
    this.colorIndex++;

    const locationRadius = radius || 500;
    const metrics = this.metricsService.getMetrics(lat, lng, locationRadius);

    const location: ManagedLocation = {
      id,
      name: name || `Standort ${this._locations().length + 1}`,
      lat,
      lng,
      radius: locationRadius,
      color,
      metrics,
      isActive: true,
    };

    // Deactivate all others
    const updated = this._locations().map(l => ({ ...l, isActive: false }));
    this._locations.set([...updated, location]);
    this._activeLocationId.set(id);

    return location;
  }

  removeLocation(id: string): void {
    const locations = this._locations().filter(l => l.id !== id);
    this._locations.set(locations);

    if (this._activeLocationId() === id) {
      const newActive = locations.length > 0 ? locations[locations.length - 1].id : null;
      this._activeLocationId.set(newActive);
      if (newActive) {
        this._locations.set(locations.map(l => ({ ...l, isActive: l.id === newActive })));
      }
    }
  }

  setActiveLocation(id: string): void {
    this._activeLocationId.set(id);
    this._locations.set(
      this._locations().map(l => ({ ...l, isActive: l.id === id }))
    );
  }

  updateLocationName(id: string, name: string): void {
    this._locations.set(
      this._locations().map(l => l.id === id ? { ...l, name } : l)
    );
  }

  updateLocationColor(id: string, color: string): void {
    this._locations.set(
      this._locations().map(l => l.id === id ? { ...l, color } : l)
    );
  }

  updateLocationRadius(id: string, radius: number): void {
    const location = this._locations().find(l => l.id === id);
    if (!location) return;

    const metrics = this.metricsService.getMetrics(location.lat, location.lng, radius);
    this._locations.set(
      this._locations().map(l => l.id === id ? { ...l, radius, metrics } : l)
    );
  }

  updateLocationPosition(id: string, lat: number, lng: number): void {
    const location = this._locations().find(l => l.id === id);
    if (!location) return;

    const metrics = this.metricsService.getMetrics(lat, lng, location.radius);
    this._locations.set(
      this._locations().map(l => l.id === id ? { ...l, lat, lng, metrics } : l)
    );
  }

  refreshMetrics(id: string): void {
    const location = this._locations().find(l => l.id === id);
    if (!location) return;

    const metrics = this.metricsService.getMetrics(location.lat, location.lng, location.radius);
    this._locations.set(
      this._locations().map(l => l.id === id ? { ...l, metrics } : l)
    );
  }

  getLocationById(id: string): ManagedLocation | undefined {
    return this._locations().find(l => l.id === id);
  }

  hasLocations(): boolean {
    return this._locations().length > 0;
  }

  getLocationCount(): number {
    return this._locations().length;
  }

  private generateId(): string {
    return `loc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}
