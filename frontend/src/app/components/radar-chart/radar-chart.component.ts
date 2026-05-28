import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, effect, HostListener, NgZone } from '@angular/core';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { LocationService } from '../../services/location.service';
import { LocationManagerService } from '../../services/location-manager.service';
import { LocationFinderService } from '../../services/location-finder.service';
import { POI_CATEGORIES, PoiCategory, ManagedLocation } from '../../models/metrics.model';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  template: `
    <div
      class="radar-floating-panel"
      [style.left.px]="posX"
      [style.top.px]="posY"
    >
      <div class="radar-drag-handle" (mousedown)="onPanelDragStart($event)" (touchstart)="onPanelTouchStart($event)">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
        <span class="drag-label">Raumqualitätsprofil</span>
        <span class="drag-hint">Punkte ziehen = Gewichtung ändern</span>
      </div>
      <div class="radar-chart-wrapper">
        <canvas #radarCanvas
          (mousedown)="onChartMouseDown($event)"
          (mousemove)="onChartMouseMove($event)"
          (mouseup)="onChartMouseUp()"
          (mouseleave)="onChartMouseUp()"
          (touchstart)="onChartTouchStart($event)"
          (touchmove)="onChartTouchMove($event)"
          (touchend)="onChartMouseUp()"
        ></canvas>
      </div>
    </div>
  `,
  styles: [`
    .radar-floating-panel {
      position: fixed;
      z-index: 15;
      width: 340px;
      height: 370px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(16px);
      border-radius: 14px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    .radar-drag-handle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      cursor: grab;
      border-bottom: 1px solid rgba(226, 232, 240, 0.6);
      color: #64748b;

      &:active {
        cursor: grabbing;
      }
    }

    .drag-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: #475569;
      flex: 1;
    }

    .drag-hint {
      font-size: 0.65rem;
      color: #94a3b8;
      font-style: italic;
    }

    .radar-chart-wrapper {
      flex: 1;
      padding: 8px 12px 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: crosshair;
    }

    canvas {
      width: 100% !important;
      height: 100% !important;
      max-width: 310px;
      max-height: 310px;
    }
  `]
})
export class RadarChartComponent implements OnInit, OnDestroy {
  @ViewChild('radarCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private locationService = inject(LocationService);
  private locationManager = inject(LocationManagerService);
  private finderService = inject(LocationFinderService);
  private ngZone = inject(NgZone);

  private readonly labels = POI_CATEGORIES.map(c => c.label);
  private readonly categoryKeys = POI_CATEGORIES.map(c => c.key);

  // Panel position (links unten)
  posX = 20;
  posY = window.innerHeight - 390;

  // Panel drag state
  private isPanelDragging = false;
  private panelDragOffsetX = 0;
  private panelDragOffsetY = 0;

  // Chart point drag state
  private isDraggingPoint = false;
  private draggedPointIndex = -1;
  private targetValues: number[] = [50, 50, 50, 50, 50, 50];
  private searchDebounce: any = null;

  // Max values for normalization
  private readonly maxValues: Record<string, number> = {
    restaurants: 30,
    supermarkets: 8,
    publicTransport: 20,
    parks: 8,
    schools: 6,
    pharmacies: 6
  };

  constructor() {
    effect(() => {
      const metrics = this.locationService.metrics();
      const managedLocations = this.locationManager.locations();
      this.updateChart();
    });
  }

  ngOnInit(): void {
    this.initTargetValues();
    this.createChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  private initTargetValues(): void {
    const metrics = this.locationService.metrics();
    this.targetValues = POI_CATEGORIES.map(cat => {
      const value = metrics[cat.key];
      const max = this.maxValues[cat.key];
      return Math.min(100, Math.round((value / max) * 100));
    });
  }

  // === Panel drag ===
  onPanelDragStart(event: MouseEvent): void {
    this.isPanelDragging = true;
    this.panelDragOffsetX = event.clientX - this.posX;
    this.panelDragOffsetY = event.clientY - this.posY;
    event.preventDefault();
  }

  onPanelTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      this.isPanelDragging = true;
      this.panelDragOffsetX = event.touches[0].clientX - this.posX;
      this.panelDragOffsetY = event.touches[0].clientY - this.posY;
      event.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent): void {
    if (this.isPanelDragging) {
      this.posX = event.clientX - this.panelDragOffsetX;
      this.posY = event.clientY - this.panelDragOffsetY;
      this.clampPosition();
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onDocTouchMove(event: TouchEvent): void {
    if (this.isPanelDragging && event.touches.length === 1) {
      this.posX = event.touches[0].clientX - this.panelDragOffsetX;
      this.posY = event.touches[0].clientY - this.panelDragOffsetY;
      this.clampPosition();
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onDocDragEnd(): void {
    this.isPanelDragging = false;
    if (this.isDraggingPoint) {
      this.isDraggingPoint = false;
      this.draggedPointIndex = -1;
      this.triggerLocationSearch();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.clampPosition();
  }

  private clampPosition(): void {
    const maxX = window.innerWidth - 350;
    const maxY = window.innerHeight - 380;
    this.posX = Math.max(0, Math.min(this.posX, maxX));
    this.posY = Math.max(0, Math.min(this.posY, maxY));
  }

  // === Chart point drag ===
  onChartMouseDown(event: MouseEvent): void {
    const pointIndex = this.getPointAtEvent(event);
    if (pointIndex >= 0) {
      this.isDraggingPoint = true;
      this.draggedPointIndex = pointIndex;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  onChartTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const pointIndex = this.getPointAtTouchEvent(event);
      if (pointIndex >= 0) {
        this.isDraggingPoint = true;
        this.draggedPointIndex = pointIndex;
        event.preventDefault();
      }
    }
  }

  onChartMouseMove(event: MouseEvent): void {
    if (!this.isDraggingPoint || this.draggedPointIndex < 0) return;
    this.updateDraggedValue(event.offsetX, event.offsetY);
  }

  onChartTouchMove(event: TouchEvent): void {
    if (!this.isDraggingPoint || this.draggedPointIndex < 0 || event.touches.length !== 1) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    this.updateDraggedValue(x, y);
  }

  onChartMouseUp(): void {
    if (this.isDraggingPoint) {
      this.isDraggingPoint = false;
      this.draggedPointIndex = -1;
      this.triggerLocationSearch();
    }
  }

  private getPointAtEvent(event: MouseEvent): number {
    if (!this.chart) return -1;
    const elements = this.chart.getElementsAtEventForMode(
      event as unknown as Event,
      'nearest',
      { intersect: true },
      false
    );
    if (elements.length > 0 && elements[0].datasetIndex === 0) {
      return elements[0].index;
    }
    return -1;
  }

  private getPointAtTouchEvent(event: TouchEvent): number {
    if (!this.chart || event.touches.length === 0) return -1;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;

    const scale = this.chart.scales['r'] as any;
    if (!scale) return -1;

    const centerX = scale.xCenter;
    const centerY = scale.yCenter;

    for (let i = 0; i < this.targetValues.length; i++) {
      const angle = scale.getIndexAngle(i) - Math.PI / 2;
      const dist = (this.targetValues[i] / 100) * scale.drawingArea;
      const px = centerX + Math.cos(angle) * dist;
      const py = centerY + Math.sin(angle) * dist;

      const dx = x - px;
      const dy = y - py;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        return i;
      }
    }
    return -1;
  }

  private updateDraggedValue(mouseX: number, mouseY: number): void {
    if (!this.chart || this.draggedPointIndex < 0) return;

    const scale = this.chart.scales['r'] as any;
    if (!scale) return;

    const centerX = scale.xCenter;
    const centerY = scale.yCenter;

    const dx = mouseX - centerX;
    const dy = mouseY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const maxDist = scale.drawingArea;
    const value = Math.max(0, Math.min(100, Math.round((distance / maxDist) * 100)));

    this.targetValues[this.draggedPointIndex] = value;
    this.updateChartWithTargets();
  }

  private triggerLocationSearch(): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);

    this.searchDebounce = setTimeout(() => {
      for (let i = 0; i < this.categoryKeys.length; i++) {
        this.finderService.setPreferenceWeight(this.categoryKeys[i], this.targetValues[i]);
      }

      const lat = this.locationService.lat();
      const lng = this.locationService.lng();
      const radius = this.locationService.radius();

      this.ngZone.run(async () => {
        await this.finderService.findOptimalLocations(lat, lng, radius * 3);
        const best = this.finderService.bestResult();
        if (best) {
          this.locationService.updateLocation(best.lat, best.lng, best.address);
        }
      });
    }, 400);
  }

  // === Chart creation ===
  private createChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: this.labels,
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 150
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 25,
              font: { size: 10 },
              color: '#94a3b8',
              backdropColor: 'transparent'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.25)',
              circular: true
            },
            angleLines: {
              color: 'rgba(148, 163, 184, 0.2)'
            },
            pointLabels: {
              font: { size: 11, weight: 'bold' },
              color: '#334155',
              padding: 8
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { size: 10 },
              boxWidth: 12,
              padding: 8
            }
          },
          tooltip: {
            enabled: !this.isDraggingPoint,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}%`
            }
          }
        },
        elements: {
          line: {
            borderWidth: 2.5
          },
          point: {
            radius: 5,
            hoverRadius: 8,
            hitRadius: 15
          }
        }
      }
    });

    this.updateChart();
  }

  private updateChart(): void {
    if (!this.chart) return;

    const metrics = this.locationService.metrics();
    const managedLocations = this.locationManager.locations();

    const currentData = POI_CATEGORIES.map(cat => {
      const value = metrics[cat.key];
      const max = this.maxValues[cat.key];
      return Math.min(100, Math.round((value / max) * 100));
    });

    // Update target values to match current if not dragging
    if (!this.isDraggingPoint) {
      this.targetValues = [...currentData];
    }

    const datasets: any[] = [];

    // If dragging, show target profile
    if (this.isDraggingPoint) {
      datasets.push({
        label: 'Gewünschtes Profil',
        data: this.targetValues,
        backgroundColor: 'rgba(99, 102, 241, 0.08)',
        borderColor: 'rgba(99, 102, 241, 0.85)',
        pointBackgroundColor: POI_CATEGORIES.map((_, i) =>
          i === this.draggedPointIndex ? 'rgba(239, 68, 68, 1)' : 'rgba(99, 102, 241, 1)'
        ),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: POI_CATEGORIES.map((_, i) =>
          i === this.draggedPointIndex ? 8 : 5
        ),
      });
    } else {
      // Current location dataset
      datasets.push({
        label: this.locationService.address() || 'Aktueller Standort',
        data: currentData,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: 'rgba(99, 102, 241, 0.85)',
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      });

      // Managed locations datasets (each with its own color)
      for (const location of managedLocations) {
        const locData = POI_CATEGORIES.map(cat => {
          const value = location.metrics[cat.key];
          const max = this.maxValues[cat.key];
          return Math.min(100, Math.round((value / max) * 100));
        });

        const rgb = this.hexToRgb(location.color);

        datasets.push({
          label: location.name,
          data: locData,
          backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.08)`,
          borderColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.85)`,
          pointBackgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 1)`,
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
        });
      }
    }

    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  private updateChartWithTargets(): void {
    if (!this.chart) return;

    const datasets: any[] = [
      {
        label: 'Gewünschtes Profil',
        data: this.targetValues,
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 0.85)',
        pointBackgroundColor: POI_CATEGORIES.map((_, i) =>
          i === this.draggedPointIndex ? 'rgba(239, 68, 68, 1)' : 'rgba(99, 102, 241, 1)'
        ),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: POI_CATEGORIES.map((_, i) =>
          i === this.draggedPointIndex ? 8 : 5
        ),
      }
    ];

    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }

  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ];
    }
    return [99, 102, 241];
  }
}
