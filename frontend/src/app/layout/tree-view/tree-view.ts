import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { StructureService } from '../../core/services/structure.service';
import { TREE_GROUPS, TreeStateService } from '../../core/services/tree-state.service';
import { type TreeRow, buildTreeRows } from './tree-rows';

const INDENT_PER_LEVEL_PX = 16;
const BASE_INDENT_PX = 8;
const STRUCTURE_KEY_PREFIX = 's:';

/**
 * F4.3 / F4.3.1: tree view of all structures, shown in the side menu.
 * Struktur and Förvaring are the top folders (Figma prototype, figures 4.1, 4.2 and 5.2);
 * under Struktur come the arkivbildare and their structures.
 * A structure's nodes are fetched the first time it is opened.
 *
 * Keyboard (code guidelines 5.8): arrow up/down move, right opens / goes to the first child,
 * left closes / goes to the parent, Home/End jump, Enter opens the row and shows it,
 * Space only shows it.
 */
@Component({
  imports: [],
  selector: 'app-tree-view',
  styleUrl: './tree-view.scss',
  templateUrl: './tree-view.html',
})
export class TreeView {
  private readonly structureService = inject(StructureService);
  private readonly treeState = inject(TreeStateService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** Row that last had keyboard focus. */
  private readonly focusedKey = signal<string | null>(null);

  readonly selectedKey = this.treeState.selectedKey;

  readonly rows = computed<TreeRow[]>(() =>
    buildTreeRows({
      groups: TREE_GROUPS,
      structures: this.structureService.structures(),
      creators: this.structureService.archiveCreators(),
      treeState: (id) => this.structureService.treeState(id),
      expanded: this.treeState.expanded(),
    }),
  );

  /** Rows that can get focus (message rows such as "Laddar …" cannot). */
  private readonly focusableRows = computed(() => this.rows().filter((r) => r.kind !== 'message'));

  /** The one row with tabindex 0, so Tab enters the tree on a sensible row. */
  readonly tabStopKey = computed(() => {
    const keys = new Set(this.focusableRows().map((row) => row.key));
    const focused = this.focusedKey();
    const selected = this.selectedKey();
    if (focused && keys.has(focused)) {
      return focused;
    }
    if (selected && keys.has(selected)) {
      return selected;
    }
    return this.focusableRows()[0]?.key ?? null;
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
    effect(() => this.loadOpenStructures());
    effect(() => this.scrollToSelected());
  }

  /** Left padding for a row at the given level. */
  indent(level: number): number {
    return BASE_INDENT_PX + (level - 1) * INDENT_PER_LEVEL_PX;
  }

  /** Tooltip with the type and the full label, since long labels are cut off. */
  tooltip(row: TreeRow): string {
    return row.typeLabel ? `${row.typeLabel}: ${row.label}` : row.label;
  }

  /** Click on the row: show it and open it (a second click keeps it open). */
  onRowClick(row: TreeRow): void {
    this.focusedKey.set(row.key);
    this.activate(row);
    if (row.hasChildren && !row.isExpanded) {
      this.treeState.expand(row.key);
    }
  }

  /** Click on the arrow: only open or close (F4.3.1). */
  onToggleClick(event: MouseEvent, row: TreeRow): void {
    event.stopPropagation();
    this.focusedKey.set(row.key);
    if (row.hasChildren) {
      this.treeState.toggle(row.key);
    }
  }

  onFocus(row: TreeRow): void {
    this.focusedKey.set(row.key);
  }

  onKeydown(event: KeyboardEvent): void {
    const rows = this.focusableRows();
    const index = rows.findIndex((row) => row.key === this.tabStopKey());
    const row = rows[index];
    if (!row) {
      return;
    }
    const handled = this.handleKey(event.key, row, index);
    if (handled) {
      event.preventDefault();
    }
  }

  private handleKey(key: string, row: TreeRow, index: number): boolean {
    const rows = this.focusableRows();
    switch (key) {
      case 'ArrowDown':
        return this.moveFocus(rows[index + 1]);
      case 'ArrowUp':
        return this.moveFocus(rows[index - 1]);
      case 'Home':
        return this.moveFocus(rows[0]);
      case 'End':
        return this.moveFocus(rows[rows.length - 1]);
      case 'ArrowRight':
        return this.openOrEnter(row, rows[index + 1]);
      case 'ArrowLeft':
        return this.closeOrLeave(row);
      case 'Enter':
        this.activate(row);
        if (row.hasChildren) {
          this.treeState.toggle(row.key);
        }
        return true;
      case ' ':
        this.activate(row);
        return true;
      default:
        return false;
    }
  }

  private openOrEnter(row: TreeRow, next: TreeRow | undefined): boolean {
    if (!row.hasChildren) {
      return false;
    }
    if (!row.isExpanded) {
      this.treeState.expand(row.key);
      return true;
    }
    return next?.parentKey === row.key ? this.moveFocus(next) : true;
  }

  private closeOrLeave(row: TreeRow): boolean {
    if (row.isExpanded) {
      this.treeState.collapse(row.key);
      return true;
    }
    const parent = this.focusableRows().find((r) => r.key === row.parentKey);
    return this.moveFocus(parent);
  }

  private moveFocus(row: TreeRow | undefined): boolean {
    if (!row) {
      return false;
    }
    this.focusedKey.set(row.key);
    const element = this.rowElement(row.key);
    if (element) {
      element.focus();
    } else {
      // The row was just opened and is not drawn yet
      afterNextRender(() => this.rowElement(row.key)?.focus(), { injector: this.injector });
    }
    return true;
  }

  /** Shows the row in the content area. */
  private activate(row: TreeRow): void {
    this.treeState.select(row.key);
    void this.router.navigate([...row.link]);
  }

  /** Fetches the tree of every open structure that has not been fetched yet. */
  private loadOpenStructures(): void {
    for (const key of this.treeState.expanded()) {
      if (!key.startsWith(STRUCTURE_KEY_PREFIX)) {
        continue;
      }
      const structureId = Number(key.slice(STRUCTURE_KEY_PREFIX.length));
      if (this.structureService.treeState(structureId).status === 'idle') {
        void this.structureService.loadTree(structureId);
      }
    }
  }

  /** Keeps the selected row visible, for example after a search hit opened its path. */
  private scrollToSelected(): void {
    const key = this.selectedKey();
    this.rows();
    if (!key) {
      return;
    }
    // afterNextRender may not be called from inside an effect's reactive context
    untracked(() =>
      afterNextRender(() => this.rowElement(key)?.scrollIntoView?.({ block: 'nearest' }), {
        injector: this.injector,
      }),
    );
  }

  private rowElement(key: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(`[data-key="${key}"]`);
  }
}
