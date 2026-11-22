import { AppState, AtomNode, ContainerNode } from '../engine/types';

export const CATALOG_ATOMS: Record<string, AtomNode> = {};

export const CATALOG_CONTAINERS: ContainerNode[] = [];

export function createInitialState(): AppState {
  return {
    progress: {},
    activeBoard: [],
    shelf: {},
    customAtoms: {},
    customContainers: [],
  };
}
