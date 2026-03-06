import { create } from "zustand";
import type {
  GameState,
  Player,
  Room,
  MapViewport,
  CombatState,
  Store,
  NPC,
} from "@/lib/types";

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
  reset: () => void;
}

const initialState: GameState = {
  player: null,
  currentRoom: null,
  mapViewport: null,
  combatState: null,
  activeStore: null,
  activeNPC: null,
  gameLog: [],
  isLoading: false,
  screen: "exploring",
};

export const useGameStore = create<GameState & GameActions>()((set) => ({
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

  reset: () => set(initialState),
}));
