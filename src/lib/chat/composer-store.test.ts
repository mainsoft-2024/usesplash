import { beforeEach, describe, expect, it, vi } from "vitest"

const { toastMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: toastMock,
}))

import { useComposerStore } from "./composer-store"
import type { LogoMentionData } from "./mention-types"

const mention = (n: number): LogoMentionData => ({
  logoId: `logo-${n}`,
  versionId: `version-${n}`,
  orderIndex: n - 1,
  versionNumber: n,
  imageUrl: `https://example.com/${n}.png`,
})

describe("useComposerStore", () => {
  beforeEach(() => {
    toastMock.mockReset()
    useComposerStore.setState({ mentionsByProject: {}, activeProjectId: null })
  })

  it("dedupes by versionId", () => {
    const first = useComposerStore.getState().addMention("p1", mention(1))
    const second = useComposerStore.getState().addMention("p1", mention(1))

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(useComposerStore.getState().mentionsByProject.p1).toHaveLength(1)
  })

  it("caps mentions at 3 and returns false on 4th", () => {
    useComposerStore.getState().addMention("p1", mention(1))
    useComposerStore.getState().addMention("p1", mention(2))
    useComposerStore.getState().addMention("p1", mention(3))
    const fourth = useComposerStore.getState().addMention("p1", mention(4))

    expect(fourth).toBe(false)
    expect(useComposerStore.getState().mentionsByProject.p1).toHaveLength(3)
    expect(toastMock).toHaveBeenCalledWith("최대 3개까지 멘션할 수 있어요")
  })

  it("removeMention only affects target project", () => {
    useComposerStore.getState().addMention("p1", mention(1))
    useComposerStore.getState().addMention("p2", mention(2))

    useComposerStore.getState().removeMention("p1", "version-1")

    expect(useComposerStore.getState().mentionsByProject.p1).toEqual([])
    expect(useComposerStore.getState().mentionsByProject.p2).toHaveLength(1)
  })

  it("clear(projectId) empties only that project and projects are isolated", () => {
    useComposerStore.getState().addMention("p1", mention(1))
    useComposerStore.getState().addMention("p2", mention(2))

    useComposerStore.getState().clear("p1")

    expect(useComposerStore.getState().mentionsByProject.p1).toEqual([])
    expect(useComposerStore.getState().mentionsByProject.p2).toEqual([mention(2)])
  })
})
