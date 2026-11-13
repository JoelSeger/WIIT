import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ImportResponse, ImportArchiveService } from '../../core/services/import-archive';

@Component({
  // FormsModule behövs för (ngSubmit) på <form>, annars laddas sidan om vid submit
  imports: [CommonModule, FormsModule, RouterLink],
  standalone: true,
  selector: 'app-import-archive',
  styleUrl: './import-archive.scss',
  templateUrl: './import-archive.html',
})
export class ImportArchiveComponent {
  private importService = inject(ImportArchiveService);

  selectedFile: File | null = null;
  isDragging = false;
  isUploading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  importResult = signal<ImportResponse | null>(null);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File) {

    if (!/\.(xml|ead|ead3)$/i.test(file.name)) {
      this.errorMessage.set('Endast .xml-, .ead- och .ead3-filer är tillåtna.');
      return;
    }

    this.selectedFile = file;
    this.errorMessage.set(null);
    this.importResult.set(null);
  }

  onSubmit() {
    if (!this.selectedFile) {
      this.errorMessage.set('Välj en fil att ladda upp.');
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.importResult.set(null);

    this.importService.uploadEadFile(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading.set(false);
        this.importResult.set(response);
        this.selectedFile = null;
      },
      error: (err) => {
        this.isUploading.set(false);
        if (err.status === 409) {
          this.errorMessage.set(err.error?.error || 'Filen finns redan.');
        } else if (err.status === 400) {
          this.errorMessage.set(err.error?.error || 'Filen är felaktig eller korrupt.');
        } else if (err.status === 403) {
          this.errorMessage.set('Du saknar behörighet att importera.');
        } else {
          this.errorMessage.set(err.error?.error || 'Ett oväntat fel uppstod.');
        }
      },
    });
  }
}
