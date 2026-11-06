
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-export-archive',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './export-archive.html',
  styleUrl: './export-archive.scss'
})
export class ExportArchive {
  exportType: 'all' | 'archive' | 'item' = 'all';

  selectedArchive: string = '';
  selectedItem: string = '';
}
