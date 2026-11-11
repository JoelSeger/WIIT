import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ArchiveCreatorSummary } from '../../models/archive-creator.model';
import type { ApiResponse, StructureSummary } from '../../models/structure.model';
import type { TreeNode } from '../../models/tree-node.model';
import { LoginService } from './login.service';

/** State of data that is fetched from the backend. */
export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'error'; message: string };

const STRUCTURES_URL = '/api/structures';
const ARCHIVE_CREATORS_URL = '/api/archive-creators';
const EDITOR_TREE_URL = '/api/node/structures';
const PUBLIC_TREE_URL = '/api/node/public/structures';
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/**
 * Fetches structures and their trees from the backend and keeps them in memory,
 * so the tree view (menu) and the node page share one copy of each tree.
 *
 * A logged-in user asks for the editor tree; if the backend says no (401/403) the
 * public tree is used instead. Public mode only returns published nodes (F5.4).
 */
@Injectable({ providedIn: 'root' })
export class StructureService {
  private readonly http = inject(HttpClient);
  private readonly loginService = inject(LoginService);

  private readonly structureState = signal<LoadState<StructureSummary[]>>({ status: 'idle' });
  private readonly creatorState = signal<LoadState<ArchiveCreatorSummary[]>>({ status: 'idle' });
  private readonly treeStates = signal<ReadonlyMap<number, LoadState<TreeNode[]>>>(new Map());
  /** Increased by reset(), so an answer that arrives after a reset is ignored. */
  private generation = 0;

  /** All structures the current user may see. */
  readonly structures = this.structureState.asReadonly();
  /** All arkivbildare the current user may see, with the ids of their structures. */
  readonly archiveCreators = this.creatorState.asReadonly();

  constructor() {
    // Published vs unpublished data depends on the login, so cached data is dropped when it changes.
    effect(() => {
      this.loginService.currentUser();
      untracked(() => this.reset());
    });
  }

  /** Fetches the structure list once. Call again after reset() to refresh. */
  async loadStructures(): Promise<void> {
    const state = this.structureState().status;
    if (state === 'loading' || state === 'loaded') {
      return;
    }
    const generation = this.generation;
    this.structureState.set({ status: 'loading' });
    let next: LoadState<StructureSummary[]>;
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<StructureSummary[]>>(STRUCTURES_URL),
      );
      next = { status: 'loaded', data: response.data };
    } catch (error: unknown) {
      next = { status: 'error', message: toUserMessage(error) };
    }
    if (generation === this.generation) {
      this.structureState.set(next);
    }
  }

  /** Fetches the arkivbildare once. Call again after reset() to refresh. */
  async loadArchiveCreators(): Promise<void> {
    const state = this.creatorState().status;
    if (state === 'loading' || state === 'loaded') {
      return;
    }
    const generation = this.generation;
    this.creatorState.set({ status: 'loading' });
    let next: LoadState<ArchiveCreatorSummary[]>;
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<ArchiveCreatorSummary[]>>(ARCHIVE_CREATORS_URL),
      );
      next = { status: 'loaded', data: response.data };
    } catch (error: unknown) {
      next = { status: 'error', message: toUserMessage(error) };
    }
    if (generation === this.generation) {
      this.creatorState.set(next);
    }
  }

  /** Returns the load state of one structure's tree (idle if never requested). */
  treeState(structureId: number): LoadState<TreeNode[]> {
    return this.treeStates().get(structureId) ?? { status: 'idle' };
  }

  /** Fetches one structure's tree once (F4.3). Does nothing if it is loaded or loading. */
  async loadTree(structureId: number): Promise<void> {
    const state = this.treeState(structureId).status;
    if (state === 'loading' || state === 'loaded') {
      return;
    }
    const generation = this.generation;
    this.setTreeState(structureId, { status: 'loading' });
    let next: LoadState<TreeNode[]>;
    try {
      next = { status: 'loaded', data: await this.fetchTree(structureId) };
    } catch (error: unknown) {
      next = { status: 'error', message: toUserMessage(error) };
    }
    if (generation === this.generation) {
      this.setTreeState(structureId, next);
    }
  }

  /** Drops all cached data, for example after login or logout. */
  reset(): void {
    this.generation++;
    this.structureState.set({ status: 'idle' });
    this.creatorState.set({ status: 'idle' });
    this.treeStates.set(new Map());
  }

  private async fetchTree(structureId: number): Promise<TreeNode[]> {
    // The backend decides who is an editor. An unpublished structure is only in the list when
    // the backend already treats us as editor (e.g. AUTH_DISABLED=true), so its tree is asked
    // for at the editor endpoint even without a login in the frontend.
    if (!this.loginService.currentUser() && !this.isUnpublished(structureId)) {
      return firstValueFrom(this.http.get<TreeNode[]>(`${PUBLIC_TREE_URL}/${structureId}/tree`));
    }
    try {
      return await firstValueFrom(
        this.http.get<TreeNode[]>(`${EDITOR_TREE_URL}/${structureId}/tree`),
      );
    } catch (error: unknown) {
      // F5.4: without the editor role the backend answers 401/403, then show the public tree.
      if (isAccessDenied(error)) {
        return firstValueFrom(this.http.get<TreeNode[]>(`${PUBLIC_TREE_URL}/${structureId}/tree`));
      }
      throw error;
    }
  }

  private isUnpublished(structureId: number): boolean {
    const state = this.structureState();
    return (
      state.status === 'loaded' &&
      state.data.some((structure) => structure.id === structureId && !structure.isPublished)
    );
  }

  private setTreeState(structureId: number, state: LoadState<TreeNode[]>): void {
    this.treeStates.update((current) => new Map(current).set(structureId, state));
  }
}

function isAccessDenied(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === HTTP_UNAUTHORIZED || error.status === HTTP_FORBIDDEN)
  );
}

/** A clear message for the user instead of a technical one (code guidelines 5.7). */
function toUserMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Något gick fel när data skulle visas.';
  }
  if (error.status === 0) {
    return 'Kunde inte nå servern. Kontrollera att backend är igång.';
  }
  if (error.status === HTTP_NOT_FOUND) {
    return 'Strukturen finns inte eller är inte publicerad.';
  }
  return 'Kunde inte hämta data från servern.';
}
