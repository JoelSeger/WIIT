import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-notification-popup',
  imports: [],
  templateUrl: './notification-popup.html',
  styleUrl: './notification-popup.scss'
})
export class NotificationPopup {

  @Input() type: 'success' | 'error' = 'success';
  @Input() message: string = '';

  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }
}
