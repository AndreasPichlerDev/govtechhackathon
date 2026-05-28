import { Injectable, signal, computed, inject } from '@angular/core';
import { MetricsService } from './metrics.service';
import { LocationMetrics, PoiCategory } from '../models/metrics.model';

export interface CompareLocation {
  lat: number;
  lng: number;
  address: string;
  metrics: LocationMetrics;
}

@Injectable({
  providedIn: 'root'
})
export class CompareService {
  private metricsService = inject(MetricsService);

  private readonly _compareLocation = signal<CompareLocation | null>(null);
  private readonly _isCompareMode = signal<boolean>(false);

  readonly compareLocation = this._compareLocation.asReadonly();
  readonly isCompareMode = this._isCompareMode.asReadonly();

  readonly hasComparison = computed(() => this._compareLocation() !== null);

  toggleCompareMode(): void {
    const newValue = !this._isCompareMode();
    this._isCompareMode.set(newValue);
    if (!newValue) {
      this._compareLocation.set(null);
    }
  }

  setCompareLocation(lat: number, lng: number, address: string, radius: number): void {
    const metrics = this.metricsService.getMetrics(lat, lng, radius);
    this._compareLocation.set({ lat, lng, address, metrics });
  }

  clearComparison(): void {
    this._compareLocation.set(null);
  }

  /**
   * Returns the difference between current and compare metrics.
   * Positive = current is better, Negative = compare is better.
   */
  getMetricsDifference(currentMetrics: LocationMetrics): Record<PoiCategory, number> | null {
    const compare = this._compareLocation();
    if (!compare) return null;

    return {
      restaurants: currentMetrics.restaurants - compare.metrics.restaurants,
      supermarkets: currentMetrics.supermarkets - compare.metrics.supermarkets,
      publicTransport: currentMetrics.publicTransport - compare.metrics.publicTransport,
      parks: currentMetrics.parks - compare.metrics.parks,
      schools: currentMetrics.schools - compare.metrics.schools,
      pharmacies: currentMetrics.pharmacies - compare.metrics.pharmacies,
    };
  }
}
