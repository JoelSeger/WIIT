import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoadingSpinner } from './components/loading-spinner/loading-spinner';
import { NotificationPopup } from './components/notification-popup/notification-popup';
import { StorageUnit } from './storage/storage-unit';


@Component({
  imports: [RouterOutlet, LoadingSpinner, NotificationPopup, StorageUnit],

  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})

export class App {
  protected readonly title = signal('WIIT');
}