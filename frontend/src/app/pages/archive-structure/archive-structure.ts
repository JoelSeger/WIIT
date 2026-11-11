import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StructureService } from '../../core/services/structure.service';
import { groupForStructureType } from '../../core/services/tree-state.service';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';

interface CreatorCard {
  creator: ArchiveCreatorSummary;
  link: readonly (string | number)[];
}

/**
 * Arkivbildare page (Figma 4.1): one card per top-level arkivbildare from GET /api/archive-creators.
 * A card opens the arkivbildare's structure directly when it has exactly one under Struktur
 * (Malmö universitet opens the Informationshanteringsplan), otherwise the arkivbildare page.
 */
@Component({
  imports: [RouterLink],
  selector: 'app-archive-structure',
  styleUrl: './archive-structure.scss',
  templateUrl: './archive-structure.html',
})
export class ArchiveStructure {
  private readonly structureService = inject(StructureService);

  readonly cards = computed<CreatorCard[]>(() => {
    const creators = this.structureService.archiveCreators();
    const structures = this.structureService.structures();
    if (creators.status !== 'loaded' || structures.status !== 'loaded') {
      return [];
    }
    const knownIds = new Set(creators.data.map((c) => c.id));
    return creators.data
      .filter((c) => c.parentId === null || !knownIds.has(c.parentId))
      .map((creator) => {
        // Only structures shown under Struktur count (not the Förvaring trees)
        const strukturIds = structures.data
          .filter((s) => creator.structureIds.includes(s.id))
          .filter((s) => groupForStructureType(s.structureType)?.showArchiveCreators)
          .map((s) => s.id);
        const [onlyId] = strukturIds;
        const link =
          strukturIds.length === 1 && onlyId !== undefined
            ? ['/structures', onlyId]
            : ['/archive-creators', creator.id];
        return { creator, link };
      });
  });

  readonly message = computed(() => {
    const state = this.structureService.archiveCreators();
    if (state.status === 'error') {
      return state.message;
    }
    if (state.status !== 'loaded' || this.structureService.structures().status !== 'loaded') {
      return 'Laddar …';
    }
    return this.cards().length === 0 ? 'Det finns inga arkivbildare att visa.' : null;
  });

  constructor() {
    effect(() => {
      if (this.structureService.structures().status === 'idle') {
        void this.structureService.loadStructures();
      }
      if (this.structureService.archiveCreators().status === 'idle') {
        void this.structureService.loadArchiveCreators();
      }
    });
  }
}
