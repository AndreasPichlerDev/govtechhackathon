import { Component } from '@angular/core';
import { MapComponent } from '../../components/map/map.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { SearchBarComponent } from '../../components/search-bar/search-bar.component';
import { RadarChartComponent } from '../../components/radar-chart/radar-chart.component';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [MapComponent, SidebarComponent, SearchBarComponent, RadarChartComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {}
