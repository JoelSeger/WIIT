import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificationPopup } from '../../components/notification-popup/notification-popup';
import {
  ExportArchiveService,
  fileNameFrom,
  saveFile,
  toExportError,
} from '../../core/services/export-archive';
import { StructureService } from '../../core/services/structure.service';
import { STRUCTURE_TYPE_LABELS } from '../../models/structure.model';
import { versionLabel } from '../../shared/tree-utils';

export type ExportType = 'all' | 'archive' | 'item';

interface StructureOption {
  id: number;
  label: string;
}

/**
 * NF6.1: EAD3 export (Yasmin's page, export-frontend e66abe4, with Muhamed's fix 707e1d6).
 * The structure is chosen from a list instead of typing its id, and can be given in the
 * address (/export-archive?structure=1) from the structure page.
 * "Hela arkivet" and "En arkivpost" are not supported by the backend yet, so they are disabled.
 * Signals are used because the app runs without zone.js: plain fields changed after an
 * HTTP answer are not drawn (that is why the popup did not always show).
 */
@Component({
  selector: 'app-export-archive',
  imports: [NotificationPopup],
  templateUrl: './export-archive.html',
  styleUrl: './export-archive.scss',
})
export class ExportArchive {
  private readonly exportService = inject(ExportArchiveService);
  private readonly structureService = inject(StructureService);
  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap);

  readonly exportType = signal<ExportType>('archive');
  readonly includeUnpublished = signal(true);
  readonly isExporting = signal(false);
  readonly notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  readonly structureOptions = computed<StructureOption[]>(() => {
    const state = this.structureService.structures();
    if (state.status !== 'loaded') {
      return [];
    }
    return state.data.map((structure) => {
      const version = versionLabel(structure.version);
      const name = version ? `${structure.name} (${version})` : structure.name;
      const type = STRUCTURE_TYPE_LABELS[structure.structureType] ?? structure.structureType;
      return { id: structure.id, label: `${name} – ${type} (id ${structure.id})` };
    });
  });

  readonly structuresMessage = computed(() => {
    const state = this.structureService.structures();
    if (state.status === 'error') {
      return state.message;
    }
    if (state.status === 'loaded' && state.data.length === 0) {
      return 'Det finns inga strukturer att exportera. Importera först.';
    }
    return null;
  });

  /** From ?structure=… when it exists, otherwise the first structure. */
  readonly selectedStructureId = linkedSignal<StructureOption[], number | null>({
    source: this.structureOptions,
    computation: (options, previous) => {
      const wanted = previous?.value ?? Number(this.queryParams()?.get('structure'));
      if (options.some((option) => option.id === wanted)) {
        return wanted;
      }
      return options[0]?.id ?? null;
    },
  });

  readonly canExport = computed(
    () =>
      this.exportType() === 'archive' && this.selectedStructureId() !== null && !this.isExporting(),
  );

  constructor() {
    effect(() => {
      if (this.structureService.structures().status === 'idle') {
        void this.structureService.loadStructures();
      }
    });
  }

  onTypeChange(type: ExportType): void {
    this.exportType.set(type);
  }

  onStructureChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedStructureId.set(value === '' ? null : Number(value));
  }

  onFullChange(event: Event): void {
    this.includeUnpublished.set((event.target as HTMLInputElement).checked);
  }

  closeNotification(): void {
    this.notification.set(null);
  }

  async exportArchive(): Promise<void> {
    const structureId = this.selectedStructureId();
    if (!this.canExport() || structureId === null) {
      return;
    }
    this.isExporting.set(true);
    this.notification.set(null);
    try {
      const response = await firstValueFrom(
        this.exportService.exportEad3(structureId, { full: this.includeUnpublished() }),
      );
      if (!response.body) {
        this.notification.set({ type: 'error', message: 'Ingen fil kunde hämtas.' });
        return;
      }
      const fileName = fileNameFrom(response.headers.get('Content-Disposition'));
      saveFile(response.body, fileName);
      this.notification.set({
        type: 'success',
        message: `Arkivinformationen har exporterats till ${fileName}.`,
      });
    } catch (error: unknown) {
      this.notification.set({ type: 'error', message: await toExportError(error) });
    } finally {
      this.isExporting.set(false);
    }
  }
}
