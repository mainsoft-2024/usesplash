type EditLogoInput = {
  logoOrderIndex?: number
  versionNumber?: number
  editPrompt: string
  referencedVersions?: string[]
  referenceImageUrls?: string[]
  outputMode?: "new_version" | "new_logo"
}

type FetchImageBuffer = (url: string) => Promise<{ buffer: Buffer; mimeType: string }>
type EditLogoImageFn = (
  prompt: string,
  sourceImageBuffer: Buffer,
  sourceMimeType?: string,
  extraReferences?: Array<{ data: string; mimeType: string }>
) => Promise<{ imageBuffer: Buffer; mimeType: string } | null>

type Ctx = {
  prisma: any
  projectId: string
  userId: string
  editLogoImage: EditLogoImageFn
  fetchImageBufferFromUrl: FetchImageBuffer
  uploadImage: (key: string, buffer: Buffer, mimeType: string) => Promise<{ url: string; bytes: number }>
  getStorageKey: (userId: string, projectId: string, logoId: string, version: string) => string
}

type EditLogoSuccess = {
  logoId: string
  logoIndex: number
  versionId: string
  versionNumber: number
  imageUrl: string
  editedFrom: number
  blobBytes: number
}

type EditLogoFailure = { error: string }

export async function runEditLogo(input: EditLogoInput, ctx: Ctx): Promise<EditLogoSuccess | EditLogoFailure> {
  const { logoOrderIndex, versionNumber, editPrompt, referencedVersions = [], referenceImageUrls = [], outputMode } = input

  const logError = (reason: string) => {
    console.error("[edit_logo]", {
      reason,
      projectId: ctx.projectId,
      logoOrderIndex,
      referencedVersions,
      referenceImageUrls,
    })
  }

  const effectiveOutputMode =
    outputMode === "new_logo" && referencedVersions.length === 0 ? "new_version" : (outputMode ?? "new_version")

  let referencedRows: Array<{ id: string; imageUrl: string; logoId: string; logo: { id: string; projectId: string } }> = []
  if (referencedVersions.length > 0) {
    const requestedReferencedVersions = referencedVersions.slice(0, 3)
    referencedRows = await ctx.prisma.logoVersion.findMany({
      where: { id: { in: requestedReferencedVersions } },
      include: { logo: true },
    })

    const referencedMap = new Map(referencedRows.map((row) => [row.id, row]))
    const missingIds = requestedReferencedVersions.filter((id) => !referencedMap.has(id))

    const fallbackByLogoId = new Map<string, (typeof referencedRows)[number]>()
    if (missingIds.length > 0) {
      const fallbackLogos = await ctx.prisma.logo.findMany({
        where: { id: { in: missingIds }, projectId: ctx.projectId },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      })

      for (const fallbackLogo of fallbackLogos) {
        const latestVersion = fallbackLogo.versions[0]
        if (!latestVersion) continue

        console.warn("[edit_logo] logoId→versionId fallback", {
          matchedLogoId: fallbackLogo.id,
          resolvedVersionId: latestVersion.id,
        })

        fallbackByLogoId.set(fallbackLogo.id, {
          id: latestVersion.id,
          imageUrl: latestVersion.imageUrl,
          logoId: fallbackLogo.id,
          logo: { id: fallbackLogo.id, projectId: ctx.projectId },
        })
      }
    }

    const unresolved = missingIds.filter((id) => !fallbackByLogoId.has(id))
    if (unresolved.length > 0) {
      logError("refs_not_found")
      return { error: `Referenced versions not found: ${unresolved.join(", ")}` }
    }

    referencedRows = requestedReferencedVersions
      .map((id) => referencedMap.get(id) ?? fallbackByLogoId.get(id))
      .filter((row): row is (typeof referencedRows)[number] => Boolean(row))

    if (referencedRows.some((row) => row.logo.projectId !== ctx.projectId)) {
      logError("refs_not_found")
      return { error: "Referenced versions must belong to the current project" }
    }
  }

  let targetLogo: any | null = null
  if (typeof logoOrderIndex === "number") {
    targetLogo = await ctx.prisma.logo.findFirst({
      where: { projectId: ctx.projectId, orderIndex: logoOrderIndex - 1 },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    })
  } else if (referencedRows.length > 0) {
    targetLogo = await ctx.prisma.logo.findUnique({
      where: { id: referencedRows[0].logoId },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    })
  }

  if (!targetLogo || targetLogo.versions.length === 0) {
    logError("target_not_found")
    return { error: typeof logoOrderIndex === "number" ? `Logo #${logoOrderIndex} not found` : "Target logo not found" }
  }

  const sourceVersion = versionNumber
    ? targetLogo.versions.find((version: any) => version.versionNumber === versionNumber)
    : (typeof logoOrderIndex !== "number" && referencedRows.length > 0 ? referencedRows[0] : targetLogo.versions[0])

  if (!sourceVersion) {
    logError("source_version_not_found")
    return { error: `Version ${versionNumber} not found for logo #${targetLogo.orderIndex + 1}` }
  }

  let sourceImage: { buffer: Buffer; mimeType: string }
  try {
    sourceImage = await ctx.fetchImageBufferFromUrl(sourceVersion.imageUrl)
  } catch {
    logError("fetch_source_failed")
    return {
      error: `Failed to load logo #${targetLogo.orderIndex + 1} source image (v${sourceVersion.versionNumber}). Please retry.`,
    }
  }

  let refBuffers: Array<{ data: string; mimeType: string }> = []
  const mergedReferenceUrls: string[] = []
  for (const row of referencedRows) {
    if (!mergedReferenceUrls.includes(row.imageUrl)) mergedReferenceUrls.push(row.imageUrl)
  }
  for (const imageUrl of referenceImageUrls) {
    if (!mergedReferenceUrls.includes(imageUrl)) mergedReferenceUrls.push(imageUrl)
  }
  if (mergedReferenceUrls.length > 3) {
    console.warn("[edit_logo] referenceImageUrls capped to 3", {
      projectId: ctx.projectId,
      requested: mergedReferenceUrls.length,
    })
  }
  const cappedReferenceUrls = mergedReferenceUrls.slice(0, 3)

  if (cappedReferenceUrls.length > 0) {
    try {
      const loaded = await Promise.all(cappedReferenceUrls.map((url) => ctx.fetchImageBufferFromUrl(url)))
      refBuffers = loaded.map((entry) => ({ data: entry.buffer.toString("base64"), mimeType: entry.mimeType }))
    } catch {
      logError("fetch_refs_failed")
      return { error: "Failed to load referenced logo images" }
    }
  }

  let result: { imageBuffer: Buffer; mimeType: string } | null
  try {
    result = await ctx.editLogoImage(editPrompt, sourceImage.buffer, sourceImage.mimeType, refBuffers)
  } catch (error) {
    logError("gemini_error")
    return {
      error: `Image editing failed due to an upstream Gemini error: ${error instanceof Error ? error.message : "Unknown error"}. Please retry in 30 seconds.`,
    }
  }

  if (!result) {
    logError("gemini_empty")
    return {
      error: "Image editing did not return an image. This is usually a temporary provider issue (429/503). Please retry in 30 seconds.",
    }
  }

  if (effectiveOutputMode === "new_logo" && referencedRows.length > 0) {
    const lastLogo = await ctx.prisma.logo.findFirst({ where: { projectId: ctx.projectId }, orderBy: { orderIndex: "desc" } })
    const orderIndex = (lastLogo?.orderIndex ?? -1) + 1
    const newLogo = await ctx.prisma.logo.create({
      data: { projectId: ctx.projectId, orderIndex, prompt: editPrompt, aspectRatio: targetLogo.aspectRatio },
    })
    const s3Key = ctx.getStorageKey(ctx.userId, ctx.projectId, newLogo.id, "v1")
    const { url: imageUrl, bytes: blobBytes } = await ctx.uploadImage(s3Key, result.imageBuffer, result.mimeType)
    const newVersion = await ctx.prisma.logoVersion.create({
      data: {
        logoId: newLogo.id,
        versionNumber: 1,
        parentVersionId: referencedRows[0].id,
        imageUrl,
        s3Key,
        editPrompt,
      },
    })

    return {
      logoId: newLogo.id,
      logoIndex: newLogo.orderIndex + 1,
      versionId: newVersion.id,
      versionNumber: 1,
      imageUrl,
      editedFrom: sourceVersion.versionNumber,
      blobBytes,
    }
  }

  const nextVersion = (targetLogo.versions[0]?.versionNumber ?? 0) + 1
  const s3Key = ctx.getStorageKey(ctx.userId, ctx.projectId, targetLogo.id, `v${nextVersion}`)
  const { url: imageUrl, bytes: blobBytes } = await ctx.uploadImage(s3Key, result.imageBuffer, result.mimeType)

  const newVersion = await ctx.prisma.logoVersion.create({
    data: {
      logoId: targetLogo.id,
      versionNumber: nextVersion,
      parentVersionId: sourceVersion.id,
      imageUrl,
      s3Key,
      editPrompt,
    },
  })

  return {
    logoId: targetLogo.id,
    logoIndex: targetLogo.orderIndex + 1,
    versionId: newVersion.id,
    versionNumber: nextVersion,
    imageUrl,
    editedFrom: sourceVersion.versionNumber,
    blobBytes,
  }
}
