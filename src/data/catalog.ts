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
    profile: {
      displayName: 'My Shelfie',
      tagline: 'Personal Watch, Read & Play log',
      avatarColor: '#E87151',
      joinedAt: new Date().toISOString(),
    },
  };
}
