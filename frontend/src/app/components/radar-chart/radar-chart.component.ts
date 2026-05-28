import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject, effect } from '@angular/core';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { LocationService } from '../../services/location.service';
import { CompareService } from '../../services/compare.service';
import { POI_CATEGORIES } from '../../models/metrics.model';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  template: `
    <div class="radar-chart-container">
      <canvas #radarCanvas></canvas>
    </div>
  `,
  styles: [`
    .radar-chart-container {
      width: 100%;
      aspect-ratio: 1;
      max-height: 220px;
      padding: 4px;
    }
    canvas {
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class RadarChartComponent implements OnInit, OnDestroy {
  @ViewChild('radarCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private locationService = inject(LocationService);
  private compareService = inject(CompareService);

  private readonly labels = POI_CATEGORIES.map(c => c.label);

  // Max values for normalization (same as in location-finder)
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
      // React to changes in metrics and compare data
      const metrics = this.locationService.metrics();
      const compareLocation = this.compareService.compareLocation();
      this.updateChart();
    });
  }

  ngOnInit(): void {
    this.createChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

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
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 25,
              font: { size: 9 },
              color: '#94a3b8',
              backdropColor: 'transparent'
            },
            grid: {
              color: 'rgba(148, 163, 184, 0.2)'
            },
            angleLines: {
              color: 'rgba(148, 163, 184, 0.2)'
            },
            pointLabels: {
              font: { size: 10, weight: 'normal' },
              color: '#475569'
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
            callbacks: {
              label: (context) => `${context.dataset.label}: ${context.raw}%`
            }
          }
        },
        elements: {
          line: {
            borderWidth: 2
          },
          point: {
            radius: 3,
            hoverRadius: 5
          }
        }
      }
    });

    this.updateChart();
  }

  private updateChart(): void {
    if (!this.chart) return;

    const metrics = this.locationService.metrics();
    const compareLocation = this.compareService.compareLocation();

    const currentData = POI_CATEGORIES.map(cat => {
      const value = metrics[cat.key];
      const max = this.maxValues[cat.key];
      return Math.min(100, Math.round((value / max) * 100));
    });

    const datasets: any[] = [
      {
        label: this.locationService.address() || 'Aktueller Standort',
        data: currentData,
        backgroundColor: 'rgba(99, 102, 241, 0.15)',
        borderColor: 'rgba(99, 102, 241, 0.8)',
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1
      }
    ];

    // Add comparison dataset if available
    if (compareLocation) {
      const compareData = POI_CATEGORIES.map(cat => {
        const value = compareLocation.metrics[cat.key];
        const max = this.maxValues[cat.key];
        return Math.min(100, Math.round((value / max) * 100));
      });

      datasets.push({
        label: compareLocation.address || 'Vergleichsstandort',
        data: compareData,
        backgroundColor: 'rgba(234, 88, 12, 0.15)',
        borderColor: 'rgba(234, 88, 12, 0.8)',
        pointBackgroundColor: 'rgba(234, 88, 12, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1
      });
    }

    this.chart.data.datasets = datasets;
    this.chart.update('none');
  }
}
