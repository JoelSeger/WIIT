import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ImportArchiveService,
  type ImportError,
  toImportError,
} from '../../core/services/import-archive';
import { StructureService } from '../../core/services/structure.service';
import type { EadIssue, EadPreview, ImportResponse } from '../../models/ead-import.model';
import { STRUCTURE_TYPE_LABELS, type StructureTypeCode } from '../../models/structure.model';
import { ALLOWED_EXTENSIONS, checkEad3Content, checkFileBasics } from './ead-file-check';

/** One choice in "Koppla till arkiv". */
interface ArchiveOption {
  id: number;
  label: string;
}

/** How many issues are listed before the rest are hidden behind "Visa alla". */
const VISIBLE_ISSUES = 10;

/**
 * NF5: import of an EAD3 file (Sandie's page, import-frontend 0384418).
 * Before anything is written the file is checked in three steps:
 *   1. name and size (same rules as the backend),
 *   2. that it is EAD3 and not RA-EAD or other XML (ead-file-check.ts),
 *   3. a preview from the backend, which shows what will be created and any errors.
 * Import is only possible when all three pass. Afterwards the tree view is refreshed.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-import-archive',
  styleUrl: './import-archive.scss',
  templateUrl: './import-archive.html',
})
export class ImportArchiveComponent {
  private readonly importService = inject(ImportArchiveService);
  private readonly structureService = inject(StructureService);

  readonly acceptedExtensions = ALLOWED_EXTENSIONS.join(',');
  readonly visibleIssues = VISIBLE_ISSUES;

  readonly selectedFile = signal<File | null>(null);
  readonly isDragging = signal(false);
  readonly isChecking = signal(false);
  readonly isUploading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly issues = signal<EadIssue[]>([]);
  readonly preview = signal<EadPreview | null>(null);
  readonly importResult = signal<ImportResponse | null>(null);

  /** Archives the import can be linked to, e.g. "Malmö universitets arkiv (Malmö universitet)". */
  readonly archiveOptions = computed<ArchiveOption[]>(() => {
    const state = this.structureService.archiveCreators();
    if (state.status !== 'loaded') {
      return [];
    }
    return state.data.flatMap((creator) =>
      creator.archives.map((archive) => ({
        id: archive.id,
        label: `${archive.name} (${creator.name})`,
      })),
    );
  });

  /** Chosen archive. With only one archive it is chosen from the start, but can be changed. */
  readonly selectedArchiveId = linkedSignal<ArchiveOption[], number | null>({
    source: this.archiveOptions,
    computation: (options, previous) => {
      const kept = previous?.value;
      if (kept !== null && kept !== undefined && options.some((option) => option.id === kept)) {
        return kept;
      }
      const [only] = options;
      return options.length === 1 && only ? only.id : null;
    },
  });

  readonly canImport = computed(
    () =>
      this.selectedFile() !== null &&
      this.preview()?.valid === true &&
      !this.isChecking() &&
      !this.isUploading(),
  );

  constructor() {
    effect(() => {
      if (this.structureService.archiveCreators().status === 'idle') {
        void this.structureService.loadArchiveCreators();
      }
    });
  }

  typeLabel(type: StructureTypeCode): string {
    return STRUCTURE_TYPE_LABELS[type] ?? type;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files.item(0);
    if (file) {
      void this.handleFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    // Cleared so that choosing the same file again (after fixing it) is noticed
    input.value = '';
    if (file) {
      void this.handleFile(file);
    }
  }

  onArchiveChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedArchiveId.set(value === '' ? null : Number(value));
  }

  /** Checks the file in three steps (see the class comment) and shows the preview. */
  async handleFile(file: File): Promise<void> {
    this.resetFor(file);
    const basics = checkFileBasics(file);
    if (!basics.ok) {
      this.showError({ message: basics.message, issues: [] });
      return;
    }
    this.isChecking.set(true);
    try {
      const content = checkEad3Content(await file.text());
      if (!content.ok) {
        this.showError({ message: content.message, issues: [] });
        return;
      }
      const preview = await firstValueFrom(this.importService.previewEadFile(file));
      if (this.selectedFile() !== file) {
        return; // another file was chosen while this one was checked
      }
      this.preview.set(preview);
      if (!preview.valid) {
        this.showError({
          message: 'Filen kan inte importeras. Backend hittade fel i den.',
          issues: preview.errors,
        });
      }
    } catch (error: unknown) {
      this.showError(toImportError(error));
    } finally {
      this.isChecking.set(false);
    }
  }

  /** Without FormsModule a form would reload the page on submit, so the default is stopped. */
  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    const file = this.selectedFile();
    if (!file || !this.canImport()) {
      return;
    }
    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.issues.set([]);
    try {
      const result = await firstValueFrom(
        this.importService.uploadEadFile(file, { archiveId: this.selectedArchiveId() }),
      );
      this.importResult.set(result);
      this.selectedFile.set(null);
      this.preview.set(null);
      // The tree view, the arkivbildare and the search should show the new structures
      this.structureService.reset();
    } catch (error: unknown) {
      this.showError(toImportError(error));
    } finally {
      this.isUploading.set(false);
    }
  }

  private resetFor(file: File): void {
    this.selectedFile.set(file);
    this.errorMessage.set(null);
    this.issues.set([]);
    this.preview.set(null);
    this.importResult.set(null);
  }

  private showError(error: ImportError): void {
    this.errorMessage.set(error.message);
    this.issues.set(error.issues);
  }
}
