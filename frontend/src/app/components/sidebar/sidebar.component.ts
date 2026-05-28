import { Component, inject, computed } from '@angular/core';
import { LocationService } from '../../services/location.service';
import { LocationFinderService } from '../../services/location-finder.service';
import { CompareService } from '../../services/compare.service';
import { PoiCategory, PoiCategoryConfig, PoiPoint, LocationScore, POI_CATEGORIES } from '../../models/metrics.model';
import { FormsModule } from '@angular/forms';

type SidebarView = 'overview' | 'category-detail' | 'finder' | 'compare';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  protected locationService = inject(LocationService);
  protected finderService = inject(LocationFinderService);
  protected compareService = inject(CompareService);
  protected isCollapsed = false;

  // View state
  protected currentView: SidebarView = 'overview';
  protected selectedCategory: PoiCategoryConfig | null = null;

  // Search/filter
  protected searchQuery = '';

  // Max values for normalization
  private readonly maxValues: Record<string, number> = {
    restaurants: 30,
    supermarkets: 8,
    publicTransport: 20,
    parks: 8,
    schools: 6,
    pharmacies: 6
  };

  protected get radiusValue(): number {
    return this.locationService.radius();
  }

  protected set radiusValue(value: number) {
    this.locationService.setRadius(value);
  }

  // Gesamtbewertung (1-10) based on all visible categories
  protected get overallScore(): number {
    const metrics = this.locationService.metrics();
    const visibility = this.locationService.categoryVisibility();
    let totalNormalized = 0;
    let count = 0;

    for (const cat of POI_CATEGORIES) {
      if (visibility[cat.key]) {
        const value = metrics[cat.key];
        const max = this.maxValues[cat.key];
        const normalized = Math.min(1, value / max);
        totalNormalized += normalized;
        count++;
      }
    }

    if (count === 0) return 0;
    return Math.round((totalNormalized / count) * 10 * 10) / 10; // 1 decimal
  }

  // Compare location overall score
  protected get compareOverallScore(): number | null {
    const compare = this.compareService.compareLocation();
    if (!compare) return null;

    const visibility = this.locationService.categoryVisibility();
    let totalNormalized = 0;
    let count = 0;

    for (const cat of POI_CATEGORIES) {
      if (visibility[cat.key]) {
        const value = compare.metrics[cat.key];
        const max = this.maxValues[cat.key];
        const normalized = Math.min(1, value / max);
        totalNormalized += normalized;
        count++;
      }
    }

    if (count === 0) return null;
    return Math.round((totalNormalized / count) * 10 * 10) / 10;
  }

  // Filtered categories based on search
  protected get filteredCategories(): PoiCategoryConfig[] {
    if (!this.searchQuery.trim()) {
      return this.locationService.categories;
    }
    const query = this.searchQuery.toLowerCase();
    return this.locationService.categories.filter(cat =>
      cat.label.toLowerCase().includes(query)
    );
  }

  // POIs for the selected category
  protected get categoryPois(): PoiPoint[] {
    if (!this.selectedCategory) return [];
    return this.locationService.poiPoints().filter(
      p => p.category === this.selectedCategory!.key
    );
  }

  // Filtered POIs based on search within category detail
  protected get filteredCategoryPois(): PoiPoint[] {
    const pois = this.categoryPois;
    if (!this.searchQuery.trim()) return pois;
    const query = this.searchQuery.toLowerCase();
    return pois.filter(p => p.name.toLowerCase().includes(query));
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  toggleCategory(category: PoiCategory): void {
    this.locationService.toggleCategory(category);
  }

  isCategoryVisible(category: PoiCategory): boolean {
    return this.locationService.isCategoryVisible(category);
  }

  // Navigate to category detail view
  openCategoryDetail(category: PoiCategoryConfig): void {
    this.selectedCategory = category;
    this.currentView = 'category-detail';
    this.searchQuery = '';
  }

  // Navigate to finder view
  openFinder(): void {
    this.currentView = 'finder';
    this.searchQuery = '';
  }

  // Navigate to compare view
  openCompare(): void {
    this.currentView = 'compare';
    this.searchQuery = '';
  }

  // Go back to overview
  goBack(): void {
    this.currentView = 'overview';
    this.selectedCategory = null;
    this.searchQuery = '';
  }

  // Save current location as comparison
  saveCurrentAsCompare(): void {
    const lat = this.locationService.lat();
    const lng = this.locationService.lng();
    const address = this.locationService.address() || 'Unbenannter Standort';
    const radius = this.locationService.radius();
    this.compareService.setCompareLocation(lat, lng, address, radius);
  }

  // Wohnort-Finder: start search
  async startFinderSearch(): Promise<void> {
    const lat = this.locationService.lat();
    const lng = this.locationService.lng();
    const radius = this.locationService.radius();
    await this.finderService.findOptimalLocations(lat, lng, radius * 3);
  }

  // Navigate to a finder result on the map
  selectFinderResult(result: LocationScore): void {
    this.locationService.updateLocation(result.lat, result.lng, result.address);
  }

  formatRadius(value: number): string {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)} km`;
    }
    return `${value} m`;
  }

  getCategoryColorStyle(color: [number, number, number, number]): string {
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1)`;
  }

  getScoreColor(score: number): string {
    if (score >= 7.5) return '#22c55e';
    if (score >= 5) return '#eab308';
    if (score >= 2.5) return '#f97316';
    return '#ef4444';
  }

  getFinderScoreColor(score: number): string {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#eab308';
    if (score >= 25) return '#f97316';
    return '#ef4444';
  }

  getCategoryForKey(key: PoiCategory): PoiCategoryConfig | undefined {
    return POI_CATEGORIES.find(c => c.key === key);
  }

  getDifference(category: PoiCategory): number | null {
    const diff = this.compareService.getMetricsDifference(this.locationService.metrics());
    if (!diff) return null;
    return diff[category];
  }
}
