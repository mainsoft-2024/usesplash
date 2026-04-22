import { create } from "zustand"
import { toast } from "sonner"
import type { LogoMentionData } from "./mention-types"

type ComposerState = {
  mentionsByProject: Record<string, LogoMentionData[]>
  activeProjectId: string | null
  addMention: (projectId: string, mention: LogoMentionData) => boolean
  removeMention: (projectId: string, versionId: string) => void
  clear: (projectId: string) => void
  setActiveProject: (id: string) => void
}

const MAX_MENTIONS = 3

export const useComposerStore = create<ComposerState>((set, get) => ({
  mentionsByProject: {},
  activeProjectId: null,
  addMention: (projectId, mention) => {
    const mentions = get().mentionsByProject[projectId] ?? []
    if (mentions.some((item) => item.versionId === mention.versionId)) {
      return true
    }

    if (mentions.length >= MAX_MENTIONS) {
      toast("최대 3개까지 멘션할 수 있어요")
      return false
    }

    set((state) => ({
      mentionsByProject: {
        ...state.mentionsByProject,
        [projectId]: [...mentions, mention],
      },
    }))

    return true
  },
  removeMention: (projectId, versionId) => {
    set((state) => ({
      mentionsByProject: {
        ...state.mentionsByProject,
        [projectId]: (state.mentionsByProject[projectId] ?? []).filter((item) => item.versionId !== versionId),
      },
    }))
  },
  clear: (projectId) => {
    set((state) => ({
      mentionsByProject: {
        ...state.mentionsByProject,
        [projectId]: [],
      },
    }))
  },
  setActiveProject: (id) => {
    set({ activeProjectId: id })
  },
}))
