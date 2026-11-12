import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StructureService } from '../../core/services/structure.service';
import type { TreeNode } from '../../models/tree-node.model';
import { nodeLabel } from '../../shared/tree-utils';

@Component({
  selector: 'app-storage-unit',
  imports: [RouterLink],
  templateUrl: './storage-unit.html',
  styleUrl: './storage-unit.scss',
})
export class StorageUnit {
  private readonly structureService = inject(StructureService);

  readonly nodeLabel = nodeLabel;

  /** All structures of the type forvaring (Figma figure 5.1). */
  private readonly storageStructures = computed(() => {
    const state = this.structureService.structures();
    return state.status === 'loaded'
      ? state.data.filter((s) => s.structureType === 'forvaring')
      : [];
  });

  /** Top storage units of every förvaring structure, e.g. Arkivförteckning 2024- and Verksamhetssystem. */
  readonly storageUnits = computed<TreeNode[]>(() =>
    this.storageStructures().flatMap((structure) => {
      const tree = this.structureService.treeState(structure.id);
      return tree.status === 'loaded' ? tree.data : [];
    }),
  );

  readonly isLoading = computed(
    () =>
      this.structureService.structures().status !== 'loaded' ||
      this.storageStructures().some(
        (s) => this.structureService.treeState(s.id).status !== 'loaded',
      ),
  );

  constructor() {
    effect(() => {
      if (this.structureService.structures().status === 'idle') {
        void this.structureService.loadStructures();
      }
    });
    effect(() => {
      for (const structure of this.storageStructures()) {
        if (this.structureService.treeState(structure.id).status === 'idle') {
          void this.structureService.loadTree(structure.id);
        }
      }
    });
  }
}
