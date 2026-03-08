import { create } from "zustand";
import type {
  GameState,
  Player,
  Room,
  MapViewport,
  CombatState,
  Store,
  NPC,
  NavigationLayer,
} from "@/lib/types";

/** Cached names for breadcrumb navigation */
export interface NavigationNames {
  worldName?: string;
  regionName?: string;
  areaName?: string;
  buildingName?: string;
  floor?: number;
}

interface GameActions {
  setPlayer: (player: Player) => void;
  setCurrentRoom: (room: Room) => void;
  setMapViewport: (viewport: MapViewport) => void;
  setCombatState: (state: CombatState | null) => void;
  setActiveStore: (store: Store | null) => void;
  setActiveNPC: (npc: NPC | null) => void;
  addToGameLog: (message: string) => void;
  clearGameLog: () => void;
  setScreen: (screen: GameState["screen"]) => void;
  setLoading: (loading: boolean) => void;
  setNavigationLayer: (layer: NavigationLayer) => void;
  setNavigationNames: (names: Partial<NavigationNames>) => void;
  reset: () => void;
}

const initialState: GameState & { navigationLayer: NavigationLayer; navigationNames: NavigationNames } = {
  player: null,
  currentRoom: null,
  mapViewport: null,
  combatState: null,
  activeStore: null,
  activeNPC: null,
  gameLog: [],
  isLoading: false,
  screen: "exploring",
  navigationLayer: "area",
  navigationNames: {},
};

export const useGameStore = create<GameState & { navigationLayer: NavigationLayer; navigationNames: NavigationNames } & GameActions>()((set) => ({
  ...initialState,

  setPlayer: (player) => set({ player }),

  setCurrentRoom: (room) => set({ currentRoom: room }),

  setMapViewport: (viewport) => set({ mapViewport: viewport }),

  setCombatState: (state) => set({ combatState: state }),

  setActiveStore: (store) => set({ activeStore: store }),

  setActiveNPC: (npc) => set({ activeNPC: npc }),

  addToGameLog: (message) =>
    set((state) => ({ gameLog: [...state.gameLog, message] })),

  clearGameLog: () => set({ gameLog: [] }),

  setScreen: (screen) => set({ screen }),

  setLoading: (loading) => set({ isLoading: loading }),

  setNavigationLayer: (layer) => set({ navigationLayer: layer }),

  setNavigationNames: (names) =>
    set((state) => ({ navigationNames: { ...state.navigationNames, ...names } })),

  reset: () => set(initialState),
}));
