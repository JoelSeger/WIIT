import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Settings } from './pages/settings/settings';
import { Header } from './layout/header/header';
import { Nav } from './layout/nav/nav';
import { Menu } from './layout/menu/menu';


@Component({
  imports: [RouterOutlet, Header, Nav, Menu, Settings],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('WIIT');
}
