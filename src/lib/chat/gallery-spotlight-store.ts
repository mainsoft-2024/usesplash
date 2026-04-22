import { create } from "zustand"

type GallerySpotlightState = {
  spotlightVersionId: string | null
  spotlight: (versionId: string) => void
  clear: () => void
}

export const useGallerySpotlightStore = create<GallerySpotlightState>((set) => ({
  spotlightVersionId: null,
  spotlight: (versionId) => set({ spotlightVersionId: versionId }),
  clear: () => set({ spotlightVersionId: null }),
}))
