import { Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StructureService } from '../../core/services/structure.service';
import { TreeStateService, creatorChain } from '../../core/services/tree-state.service';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import { STRUCTURE_TYPE_LABELS, type StructureSummary } from '../../models/structure.model';
import { versionLabel } from '../../shared/tree-utils';

interface StructureGroup {
  typeLabel: string;
  structures: StructureSummary[];
}

/**
 * Content area for one arkivbildare (/archive-creators/:creatorId): its sub-creators and
 * the structures its archives use, as cards (Figma 4.1). Opens the arkivbildare in the tree view.
 */
@Component({
  selector: 'app-archive-creator-view',
  imports: [RouterLink],
  templateUrl: './archive-creator-view.html',
  styleUrl: './archive-creator-view.scss',
})
export class ArchiveCreatorView {
  private readonly structureService = inject(StructureService);
  private readonly treeState = inject(TreeStateService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);

  readonly creatorId = computed(() => Number(this.params()?.get('creatorId')));

  private readonly creators = computed<ArchiveCreatorSummary[] | null>(() => {
    const state = this.structureService.archiveCreators();
    return state.status === 'loaded' ? state.data : null;
  });

  readonly loadError = computed(() => {
    const state = this.structureService.archiveCreators();
    return state.status === 'error' ? state.message : null;
  });

  readonly creator = computed(
    () => this.creators()?.find((c) => c.id === this.creatorId()) ?? null,
  );

  /** Parent creators, root first, for the breadcrumb. */
  readonly parents = computed(() => {
    const creators = this.creators();
    return creators ? creatorChain(this.creatorId(), creators).slice(0, -1) : [];
  });

  readonly subCreators = computed(
    () => this.creators()?.filter((c) => c.parentId === this.creatorId()) ?? [],
  );

  /** The creator's structures, grouped by type (Klassificeringsstruktur, Förvaring ...). */
  readonly structureGroups = computed<StructureGroup[]>(() => {
    const state = this.structureService.structures();
    const ids = this.creator()?.structureIds ?? [];
    if (state.status !== 'loaded') {
      return [];
    }
    const groups = new Map<string, StructureGroup>();
    for (const structure of state.data.filter((s) => ids.includes(s.id))) {
      const typeLabel = STRUCTURE_TYPE_LABELS[structure.structureType] ?? structure.structureType;
      const group = groups.get(typeLabel) ?? { typeLabel, structures: [] };
      group.structures.push(structure);
      groups.set(typeLabel, group);
    }
    return [...groups.values()];
  });

  readonly isLoading = computed(() => this.creators() === null && this.loadError() === null);

  readonly years = computed(() => {
    const creator = this.creator();
    if (!creator || (creator.startYear === null && creator.endYear === null)) {
      return null;
    }
    return `${creator.startYear ?? ''}–${creator.endYear ?? ''}`;
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
    effect(() => {
      const creator = this.creator();
      const creators = this.creators();
      if (creator && creators) {
        untracked(() => this.treeState.revealCreator(creator.id, creators));
      }
    });
  }

  /** "Informationshanteringsplan (Version 2)" */
  structureLabel(structure: StructureSummary): string {
    const version = versionLabel(structure.version);
    return version ? `${structure.name} (${version})` : structure.name;
  }
}
