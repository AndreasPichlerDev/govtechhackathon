import { Component, OnInit, OnDestroy, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { LocationService } from '../../services/location.service';
import { LocationManagerService } from '../../services/location-manager.service';
import { POI_CATEGORIES, PoiPoint, ManagedLocation } from '../../models/metrics.model';
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
  private mainMarker!: Marker;
  private deckOverlay!: MapboxOverlay;
  private locationService = inject(LocationService);
  private locationManager = inject(LocationManagerService);
  private lastLat = 0;
  private lastLng = 0;
  private managedMarkers = new window.Map<string, Marker>();

  constructor() {
    // React to location/radius/visibility/polygon changes
    effect(() => {
      const lat = this.locationService.lat();
      const lng = this.locationService.lng();
      const radius = this.locationService.radius();
      const visiblePoints = this.locationService.visiblePoiPoints();
      const polygon = this.locationService.polygon();
      const areaMode = this.locationService.areaMode();
      const managedLocations = this.locationManager.locations();

      if (this.map && this.mainMarker && this.deckOverlay) {
        if (lat !== this.lastLat || lng !== this.lastLng) {
          this.mainMarker.setLngLat([lng, lat]);
          this.map.flyTo({ center: [lng, lat], essential: true });
          this.lastLat = lat;
          this.lastLng = lng;
        }
        this.updateManagedMarkers(managedLocations);
        this.updateDeckLayers(lat, lng, radius, visiblePoints, polygon, areaMode, managedLocations);
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
    this.managedMarkers.forEach(m => m.remove());
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

    this.map.addControl(new NavigationControl(), 'top-left');

    // Main draggable marker
    this.mainMarker = new Marker({
      draggable: true,
      color: '#6366f1'
    })
      .setLngLat([lng, lat])
      .addTo(this.map);

    this.mainMarker.on('dragend', () => {
      const lngLat = this.mainMarker.getLngLat();
      this.locationService.setLocation(lngLat.lat, lngLat.lng);
      this.locationService.setAddress('');
    });

    // Handle map click for polygon drawing
    this.map.on('click', (e) => {
      if (this.locationService.isDrawing()) {
        this.locationService.addPolygonPoint(e.lngLat.lng, e.lngLat.lat);
      }
    });

    this.map.on('mousemove', () => {
      if (this.locationService.isDrawing()) {
        this.map.getCanvas().style.cursor = 'crosshair';
      } else {
        this.map.getCanvas().style.cursor = '';
      }
    });

    // Initialize Deck.gl overlay
    this.deckOverlay = new MapboxOverlay({
      interleaved: true,
      layers: []
    });

    this.map.addControl(this.deckOverlay as any);

    this.map.on('load', () => {
      const visiblePoints = this.locationService.visiblePoiPoints();
      const polygon = this.locationService.polygon();
      const areaMode = this.locationService.areaMode();
      const managedLocations = this.locationManager.locations();
      this.updateDeckLayers(lat, lng, this.locationService.radius(), visiblePoints, polygon, areaMode, managedLocations);
    });
  }

  private updateManagedMarkers(locations: ManagedLocation[]): void {
    // Remove markers that no longer exist
    const currentIds = new Set(locations.map(l => l.id));
    this.managedMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        this.managedMarkers.delete(id);
      }
    });

    // Add/update markers
    for (const location of locations) {
      let marker = this.managedMarkers.get(location.id);
      if (!marker) {
        // Create new marker
        marker = new Marker({
          draggable: true,
          color: location.color
        })
          .setLngLat([location.lng, location.lat])
          .addTo(this.map);

        // Handle drag
        const locId = location.id;
        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat();
          this.locationManager.updateLocationPosition(locId, lngLat.lat, lngLat.lng);
        });

        this.managedMarkers.set(location.id, marker);
      } else {
        // Update position if changed
        const currentPos = marker.getLngLat();
        if (Math.abs(currentPos.lat - location.lat) > 0.00001 || Math.abs(currentPos.lng - location.lng) > 0.00001) {
          marker.setLngLat([location.lng, location.lat]);
        }
      }
    }
  }

  private updateDeckLayers(
    lat: number,
    lng: number,
    radius: number,
    poiPoints: PoiPoint[],
    polygon: [number, number][],
    areaMode: string,
    managedLocations: ManagedLocation[]
  ): void {
    const colorMap = new window.Map<string, [number, number, number, number]>();
    for (const cat of POI_CATEGORIES) {
      colorMap.set(cat.key, cat.color);
    }

    const layers: any[] = [];

    // Area layer: either radius circle or drawn polygon
    if (areaMode === 'polygon' && polygon.length >= 3) {
      const closedPolygon = [...polygon, polygon[0]];
      layers.push(
        new PolygonLayer({
          id: 'drawn-polygon-fill',
          data: [{ polygon: closedPolygon }],
          getPolygon: (d: any) => d.polygon,
          getFillColor: [34, 197, 94, 30],
          getLineColor: [34, 197, 94, 200],
          getLineWidth: 3,
          lineWidthUnits: 'pixels' as const,
          filled: true,
          stroked: true,
          pickable: false,
        })
      );
      layers.push(
        new ScatterplotLayer({
          id: 'polygon-vertices',
          data: polygon.map(p => ({ position: p })),
          getPosition: (d: any) => d.position,
          getFillColor: [34, 197, 94, 255],
          getLineColor: [255, 255, 255, 255],
          getRadius: 6,
          radiusUnits: 'pixels' as const,
          filled: true,
          stroked: true,
          getLineWidth: 2,
          lineWidthUnits: 'pixels' as const,
          pickable: false,
        })
      );
    } else if (areaMode === 'polygon' && polygon.length > 0 && polygon.length < 3) {
      layers.push(
        new ScatterplotLayer({
          id: 'polygon-vertices-partial',
          data: polygon.map(p => ({ position: p })),
          getPosition: (d: any) => d.position,
          getFillColor: [34, 197, 94, 255],
          getLineColor: [255, 255, 255, 255],
          getRadius: 6,
          radiusUnits: 'pixels' as const,
          filled: true,
          stroked: true,
          getLineWidth: 2,
          lineWidthUnits: 'pixels' as const,
          pickable: false,
        })
      );
    } else {
      // Default radius circle for main location
      const circlePolygon = this.createCirclePolygon(lng, lat, radius);
      layers.push(
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
        })
      );
    }

    // Managed location radius circles
    for (let i = 0; i < managedLocations.length; i++) {
      const loc = managedLocations[i];
      const circlePolygon = this.createCirclePolygon(loc.lng, loc.lat, loc.radius);
      const color = this.hexToRgba(loc.color);

      layers.push(
        new PolygonLayer({
          id: `managed-circle-${loc.id}`,
          data: [{ polygon: circlePolygon }],
          getPolygon: (d: any) => d.polygon,
          getFillColor: [color[0], color[1], color[2], 20] as [number, number, number, number],
          getLineColor: [color[0], color[1], color[2], 180] as [number, number, number, number],
          getLineWidth: 2,
          lineWidthUnits: 'pixels' as const,
          filled: true,
          stroked: true,
          pickable: false,
        })
      );
    }

    // POI points layer
    layers.push(
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
      })
    );

    // Center point
    layers.push(
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
      })
    );

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

  private hexToRgba(hex: string): [number, number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
        255
      ];
    }
    return [99, 102, 241, 255];
  }
}
