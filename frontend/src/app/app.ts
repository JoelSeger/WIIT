import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Settings } from './pages/settings/settings';

@Component({
  imports: [RouterOutlet, Settings],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('WIIT');
}
