import { Component, inject  } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationPopup }from '../../components/notification-popup/notification-popup';

@Component({
  selector: 'app-export-archive',
  standalone: true,
  imports: [FormsModule, NotificationPopup],
  templateUrl: './export-archive.html',
  styleUrl: './export-archive.scss'
})
export class ExportArchive {
  exportType: 'all' | 'archive' | 'item' = 'all';

  selectedArchive: string = '';
  selectedItem: string = '';
  notificationMessage: string = '';
  notificationType: 'success' | 'error' = 'success';
  showNotification: boolean = false;
  private http = inject(HttpClient);

  showPopup(message: string, type: 'success' | 'error'): void {
  this.notificationMessage = message;
  this.notificationType = type;
  this.showNotification = true;
}

exportArchive(): void {
  if (this.exportType !== 'archive') {
    this.showPopup('Det valda exportalternativet stöds inte ännu.', 'error');
    return;
  }

  const id = this.selectedArchive.trim();

  if (!id) {
  this.showPopup('Ange ett struktur-ID.', 'error');
  return;
  }

  this.http.get(`/api/structures/${encodeURIComponent(id)}/export/ead3`, {
    params: { full: 'true' },
    responseType: 'blob',
    observe: 'response'
  }).subscribe({
    next:(response) => {
  const file = response.body;

  if (!file) {
    this.showPopup('Ingen fil kunde hämtas.', 'error');
    return;
  }

  const url = URL.createObjectURL(file);
      const link = document.createElement('a');

      link.href = url;
      const header = response.headers.get('Content-Disposition');
      let filename = 'arkivexport.xml';

      if (header && header.includes('filename=')) {
      filename = header.split('filename=')[1].split(';')[0].replaceAll('"', '');
}

      link.download = filename;
      link.click();
      this.showPopup('Arkivinformationen har exporterats!', 'success');

      URL.revokeObjectURL(url);
    },
    error: () => {
      this.showPopup('Exporten misslyckades.', 'error');
    }
  });
}

}
