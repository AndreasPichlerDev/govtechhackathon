import { Component, OnInit, OnDestroy, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { LocationService } from '../../services/location.service';
import { POI_CATEGORIES, PoiPoint } from '../../models/metrics.model';
import { Map, NavigationControl, Marker } from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { ScatterplotLayer, PolygonLayer } from '@deck.gl/layers';

@Component({
  selector: 'app-map',
  standalone: true,
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss'
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private map!: Map;
  private marker!: Marker;
  private deckOverlay!: MapboxOverlay;
  private locationService = inject(LocationService);
  private lastLat = 0;
  private lastLng = 0;

  constructor() {
    // React to location/radius/visibility changes and update deck.gl layers
    effect(() => {
      const lat = this.locationService.lat();
      const lng = this.locationService.lng();
      const radius = this.locationService.radius();
      const visiblePoints = this.locationService.visiblePoiPoints();

      if (this.map && this.marker && this.deckOverlay) {
        // Only fly to new position if location actually changed
        if (lat !== this.lastLat || lng !== this.lastLng) {
          this.marker.setLngLat([lng, lat]);
          this.map.flyTo({ center: [lng, lat], essential: true });
          this.lastLat = lat;
          this.lastLng = lng;
        }
        this.updateDeckLayers(lat, lng, radius, visiblePoints);
      }
    });
  }

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.deckOverlay) {
      this.deckOverlay.finalize();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap(): void {
    const lat = this.locationService.lat();
    const lng = this.locationService.lng();
    this.lastLat = lat;
    this.lastLng = lng;

    this.map = new Map({
      container: this.mapContainer.nativeElement,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [lng, lat],
      zoom: 14,
    });

    // Add navigation controls
    this.map.addControl(new NavigationControl(), 'top-left');

    // Create draggable marker
    this.marker = new Marker({
      draggable: true,
      color: '#6366f1'
    })
      .setLngLat([lng, lat])
      .addTo(this.map);

    // Handle marker drag end
    this.marker.on('dragend', () => {
      const lngLat = this.marker.getLngLat();
      this.locationService.setLocation(lngLat.lat, lngLat.lng);
      this.locationService.setAddress('');
    });

    // Initialize Deck.gl overlay
    this.deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: []
    });

    this.map.addControl(this.deckOverlay as any);

    // Add deck.gl layers once map is loaded
    this.map.on('load', () => {
      const visiblePoints = this.locationService.visiblePoiPoints();
      this.updateDeckLayers(lat, lng, this.locationService.radius(), visiblePoints);
    });
  }

  private updateDeckLayers(lat: number, lng: number, radius: number, poiPoints: PoiPoint[]): void {
    const circlePolygon = this.createCirclePolygon(lng, lat, radius);

    // Create a color map for categories
    const colorMap = new window.Map<string, [number, number, number, number]>();
    for (const cat of POI_CATEGORIES) {
      colorMap.set(cat.key, cat.color);
    }

    const layers = [
      // Filled radius circle layer
      new PolygonLayer({
        id: 'radius-circle-fill',
        data: [{ polygon: circlePolygon }],
        getPolygon: (d: any) => d.polygon,
        getFillColor: [99, 102, 241, 25],
        getLineColor: [99, 102, 241, 160],
        getLineWidth: 2,
        lineWidthUnits: 'pixels' as const,
        filled: true,
        stroked: true,
        pickable: false,
      }),
      // POI points layer
      new ScatterplotLayer({
        id: 'poi-points',
        data: poiPoints,
        getPosition: (d: PoiPoint) => d.position,
        getFillColor: (d: PoiPoint) => colorMap.get(d.category) || [128, 128, 128, 200],
        getRadius: 6,
        radiusUnits: 'pixels' as const,
        filled: true,
        pickable: true,
        radiusMinPixels: 4,
        radiusMaxPixels: 10,
      }),
      // Center point highlight (on top)
      new ScatterplotLayer({
        id: 'center-point',
        data: [{ position: [lng, lat] }],
        getPosition: (d: any) => d.position,
        getFillColor: [99, 102, 241, 220],
        getLineColor: [255, 255, 255, 255],
        getRadius: 10,
        lineWidthUnits: 'pixels' as const,
        radiusUnits: 'pixels' as const,
        filled: true,
        stroked: true,
        getLineWidth: 2,
        pickable: false,
      }),
    ];

    this.deckOverlay.setProps({ layers });
  }

  private createCirclePolygon(lng: number, lat: number, radiusMeters: number): [number, number][] {
    const points = 64;
    const coords: [number, number][] = [];

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * (2 * Math.PI);
      const dx = radiusMeters * Math.cos(angle);
      const dy = radiusMeters * Math.sin(angle);

      const dLat = dy / 111320;
      const dLng = dx / (111320 * Math.cos((lat * Math.PI) / 180));

      coords.push([lng + dLng, lat + dLat]);
    }

    return coords;
  }
}
