import { Component, inject } from '@angular/core';
import { LocationService, AreaMode } from '../../services/location.service';
import { LocationFinderService } from '../../services/location-finder.service';
import { LocationManagerService } from '../../services/location-manager.service';
import { PoiCategory, PoiCategoryConfig, PoiPoint, LocationScore, ManagedLocation, POI_CATEGORIES, LOCATION_COLORS } from '../../models/metrics.model';
import { FormsModule } from '@angular/forms';

type SidebarView = 'overview' | 'category-detail' | 'finder' | 'locations';

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
  protected locationManager = inject(LocationManagerService);
  protected isCollapsed = false;

  // View state
  protected currentView: SidebarView = 'overview';
  protected selectedCategory: PoiCategoryConfig | null = null;

  // Search/filter
  protected searchQuery = '';

  // Location editing
  protected editingLocationId: string | null = null;
  protected editingName = '';

  // Available colors
  protected availableColors = LOCATION_COLORS;

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

  // Navigate to locations management view
  openLocations(): void {
    this.currentView = 'locations';
    this.searchQuery = '';
  }

  // Go back to overview
  goBack(): void {
    this.currentView = 'overview';
    this.selectedCategory = null;
    this.searchQuery = '';
    this.editingLocationId = null;
  }

  // === Location Management ===

  addCurrentAsLocation(): void {
    const lat = this.locationService.lat();
    const lng = this.locationService.lng();
    const address = this.locationService.address() || undefined;
    const radius = this.locationService.radius();
    this.locationManager.addLocation(lat, lng, address, radius);
  }

  dropNewMarker(): void {
    // Add a location slightly offset from center for visibility
    const lat = this.locationService.lat() + (Math.random() - 0.5) * 0.005;
    const lng = this.locationService.lng() + (Math.random() - 0.5) * 0.005;
    const radius = this.locationService.radius();
    this.locationManager.addLocation(lat, lng, undefined, radius);
  }

  removeLocation(id: string): void {
    this.locationManager.removeLocation(id);
    if (this.editingLocationId === id) {
      this.editingLocationId = null;
    }
  }

  selectLocation(location: ManagedLocation): void {
    this.locationManager.setActiveLocation(location.id);
    this.locationService.updateLocation(location.lat, location.lng, location.name);
    this.locationService.setRadius(location.radius);
  }

  startEditingName(location: ManagedLocation): void {
    this.editingLocationId = location.id;
    this.editingName = location.name;
  }

  saveLocationName(id: string): void {
    if (this.editingName.trim()) {
      this.locationManager.updateLocationName(id, this.editingName.trim());
    }
    this.editingLocationId = null;
  }

  setLocationColor(id: string, color: string): void {
    this.locationManager.updateLocationColor(id, color);
  }

  setLocationRadius(id: string, radius: number): void {
    this.locationManager.updateLocationRadius(id, radius);
  }

  getLocationScore(location: ManagedLocation): number {
    const visibility = this.locationService.categoryVisibility();
    let totalNormalized = 0;
    let count = 0;

    for (const cat of POI_CATEGORIES) {
      if (visibility[cat.key]) {
        const value = location.metrics[cat.key];
        const max = this.maxValues[cat.key];
        const normalized = Math.min(1, value / max);
        totalNormalized += normalized;
        count++;
      }
    }

    if (count === 0) return 0;
    return Math.round((totalNormalized / count) * 10 * 10) / 10;
  }

  // === Area mode ===
  setAreaMode(mode: AreaMode): void {
    this.locationService.setAreaMode(mode);
  }

  startPolygonDrawing(): void {
    this.locationService.startDrawing();
  }

  finishDrawing(): void {
    this.locationService.finishDrawing();
  }

  clearPolygon(): void {
    this.locationService.clearPolygon();
  }

  // === Finder ===
  async startFinderSearch(): Promise<void> {
    const lat = this.locationService.lat();
    const lng = this.locationService.lng();
    const radius = this.locationService.radius();
    await this.finderService.findOptimalLocations(lat, lng, radius * 3);
  }

  selectFinderResult(result: LocationScore): void {
    this.locationService.updateLocation(result.lat, result.lng, result.address);
  }

  // === Helpers ===
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
}
