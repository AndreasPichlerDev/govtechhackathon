import { Injectable, signal, computed } from '@angular/core';
import { MetricsService } from './metrics.service';
import { CategoryPreference, LocationScore, PoiCategory, POI_CATEGORIES } from '../models/metrics.model';

@Injectable({
  providedIn: 'root'
})
export class LocationFinderService {

  private readonly _preferences = signal<CategoryPreference[]>(
    POI_CATEGORIES.map(cat => ({
      category: cat.key,
      weight: 50,
      enabled: true
    }))
  );

  private readonly _isSearching = signal<boolean>(false);
  private readonly _results = signal<LocationScore[]>([]);
  private readonly _hasSearched = signal<boolean>(false);

  readonly preferences = this._preferences.asReadonly();
  readonly isSearching = this._isSearching.asReadonly();
  readonly results = this._results.asReadonly();
  readonly hasSearched = this._hasSearched.asReadonly();

  readonly enabledPreferences = computed(() =>
    this._preferences().filter(p => p.enabled)
  );

  readonly bestResult = computed(() => {
    const r = this._results();
    return r.length > 0 ? r[0] : null;
  });

  constructor(private metricsService: MetricsService) {}

  setPreferenceWeight(category: PoiCategory, weight: number): void {
    const prefs = this._preferences().map(p =>
      p.category === category ? { ...p, weight } : p
    );
    this._preferences.set(prefs);
  }

  togglePreference(category: PoiCategory): void {
    const prefs = this._preferences().map(p =>
      p.category === category ? { ...p, enabled: !p.enabled } : p
    );
    this._preferences.set(prefs);
  }

  /**
   * Searches for optimal locations based on user preferences.
   * In production this would call a backend API.
   * Currently generates mock candidate locations and scores them.
   */
  async findOptimalLocations(baseLat: number, baseLng: number, searchRadius: number): Promise<void> {
    this._isSearching.set(true);
    this._hasSearched.set(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    const candidates = this.generateCandidateLocations(baseLat, baseLng, searchRadius);
    const scored = this.scoreCandidates(candidates);

    // Sort by total score descending
    scored.sort((a, b) => b.totalScore - a.totalScore);

    this._results.set(scored.slice(0, 5)); // Top 5 results
    this._isSearching.set(false);
  }

  private generateCandidateLocations(baseLat: number, baseLng: number, radius: number): { lat: number; lng: number; address: string }[] {
    const candidates: { lat: number; lng: number; address: string }[] = [];
    const streetNames = [
      'Bahnhofstrasse', 'Limmatquai', 'Langstrasse', 'Seefeldstrasse',
      'Birmensdorferstrasse', 'Badenerstrasse', 'Rämistrasse', 'Weinbergstrasse',
      'Militärstrasse', 'Josefstrasse', 'Hardstrasse', 'Weststrasse',
      'Nordstrasse', 'Schaffhauserstrasse', 'Universitätstrasse', 'Stampfenbachstrasse',
      'Kasernenstrasse', 'Lagerstrasse', 'Heinrichstrasse', 'Geroldstrasse'
    ];

    // Generate 20 candidate points within the search area
    for (let i = 0; i < 20; i++) {
      const angle = this.seededRandom(baseLat * 77 + baseLng * 33 + i * 47) * 2 * Math.PI;
      const dist = this.seededRandom(baseLat * 11 + baseLng * 99 + i * 23) * radius;

      const dLat = (dist * Math.sin(angle)) / 111320;
      const dLng = (dist * Math.cos(angle)) / (111320 * Math.cos((baseLat * Math.PI) / 180));

      const streetNum = Math.floor(this.seededRandom(i * 137 + baseLat * 50) * 120) + 1;
      const streetName = streetNames[i % streetNames.length];

      candidates.push({
        lat: baseLat + dLat,
        lng: baseLng + dLng,
        address: `${streetName} ${streetNum}`
      });
    }

    return candidates;
  }

  private scoreCandidates(candidates: { lat: number; lng: number; address: string }[]): LocationScore[] {
    const preferences = this._preferences().filter(p => p.enabled);
    const totalWeight = preferences.reduce((sum, p) => sum + p.weight, 0);

    if (totalWeight === 0) return [];

    return candidates.map(candidate => {
      const metrics = this.metricsService.getMetrics(candidate.lat, candidate.lng, 1000);
      const categoryScores: Record<PoiCategory, number> = {} as Record<PoiCategory, number>;

      // Calculate score for each category (0-100)
      const maxValues: Record<PoiCategory, number> = {
        restaurants: 30,
        supermarkets: 8,
        publicTransport: 20,
        parks: 8,
        schools: 6,
        pharmacies: 6
      };

      let weightedSum = 0;

      for (const pref of preferences) {
        const actual = metrics[pref.category];
        const max = maxValues[pref.category];
        const score = Math.min(100, Math.round((actual / max) * 100));
        categoryScores[pref.category] = score;
        weightedSum += score * (pref.weight / totalWeight);
      }

      // Fill in non-enabled categories with 0
      for (const cat of POI_CATEGORIES) {
        if (!(cat.key in categoryScores)) {
          categoryScores[cat.key] = 0;
        }
      }

      return {
        lat: candidate.lat,
        lng: candidate.lng,
        address: candidate.address,
        totalScore: Math.round(weightedSum),
        categoryScores
      };
    });
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  resetResults(): void {
    this._results.set([]);
    this._hasSearched.set(false);
  }
}
