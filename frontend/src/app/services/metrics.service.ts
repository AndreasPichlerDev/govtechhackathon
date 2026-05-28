import { Injectable } from '@angular/core';
import { LocationMetrics, PoiPoint, PoiCategory } from '../models/metrics.model';

@Injectable({
  providedIn: 'root'
})
export class MetricsService {

  /**
   * Generates mock metrics based on coordinates and radius.
   * In production, this would call a backend API.
   */
  getMetrics(lat: number, lng: number, radius: number): LocationMetrics {
    const seed = Math.abs(Math.sin(lat * 1000 + lng * 500) * 10000);
    const radiusFactor = radius / 500;

    return {
      restaurants: Math.max(1, Math.round((seed % 15 + 3) * radiusFactor)),
      supermarkets: Math.max(1, Math.round((seed % 5 + 1) * radiusFactor)),
      publicTransport: Math.max(1, Math.round((seed % 10 + 2) * radiusFactor)),
      parks: Math.max(1, Math.round((seed % 4 + 1) * radiusFactor)),
      schools: Math.max(0, Math.round((seed % 3) * radiusFactor)),
      pharmacies: Math.max(1, Math.round((seed % 4 + 1) * radiusFactor)),
    };
  }

  /**
   * Generates mock POI points within the given radius around the center.
   * Each point has a position, category, and name.
   */
  getPoiPoints(lat: number, lng: number, radius: number): PoiPoint[] {
    const metrics = this.getMetrics(lat, lng, radius);
    const points: PoiPoint[] = [];

    const categories: { key: PoiCategory; count: number; names: string[] }[] = [
      { key: 'restaurants', count: metrics.restaurants, names: ['Pizzeria', 'Sushi Bar', 'Bistro', 'Gasthof', 'Trattoria', 'Brasserie', 'Kebab', 'Thai Imbiss', 'Café', 'Steakhouse', 'Ramen', 'Burgers', 'Indisch', 'Griechisch', 'Vietnamesisch'] },
      { key: 'supermarkets', count: metrics.supermarkets, names: ['Migros', 'Coop', 'Aldi', 'Lidl', 'Denner', 'Spar', 'Volg'] },
      { key: 'publicTransport', count: metrics.publicTransport, names: ['Bushaltestelle', 'Tramhaltestelle', 'S-Bahn', 'Bahnhof', 'Haltestelle'] },
      { key: 'parks', count: metrics.parks, names: ['Stadtpark', 'Grünanlage', 'Spielplatz', 'Garten', 'Waldweg'] },
      { key: 'schools', count: metrics.schools, names: ['Primarschule', 'Sekundarschule', 'Gymnasium', 'Kindergarten', 'Berufsschule'] },
      { key: 'pharmacies', count: metrics.pharmacies, names: ['Apotheke', 'Drogerie', 'Pharma', 'Gesundheitszentrum'] },
    ];

    for (const category of categories) {
      for (let i = 0; i < category.count; i++) {
        const angle = this.seededRandom(lat * 100 + lng * 200 + i * 37 + category.key.length) * 2 * Math.PI;
        const distance = this.seededRandom(lat * 300 + lng * 100 + i * 53 + category.key.length * 2) * radius;

        const dLat = (distance * Math.sin(angle)) / 111320;
        const dLng = (distance * Math.cos(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));

        const name = category.names[i % category.names.length];

        points.push({
          position: [lng + dLng, lat + dLat],
          category: category.key,
          name: `${name} ${i + 1}`,
        });
      }
    }

    return points;
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }
}
