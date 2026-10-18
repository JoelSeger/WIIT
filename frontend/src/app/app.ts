import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';
import { Nav } from './layout/nav/nav';
import { Menu } from './layout/menu/menu';


@Component({
  imports: [RouterOutlet, Header, Nav, Menu],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('WIIT');
}
