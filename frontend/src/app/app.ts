import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Settings } from './pages/settings/settings';
import { Header } from './layout/header/header';
import { Nav } from './layout/nav/nav';
import { Menu } from './layout/menu/menu';


@Component({
  standalone: true,
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('WIIT');
}
