## ADDED Requirements

### Requirement: SVG download in version modal
The gallery version modal SHALL expose a functional "SVG 다운로드" button alongside the existing "PNG 다운로드" button. Clicking the button SHALL trigger the `export.vectorize` mutation, show an inline spinner with the button disabled while pending, and on success trigger an automatic browser download of the resulting SVG. Subsequent clicks on the same version SHALL use the cached `svgUrl` (no re-vectorize).

#### Scenario: First SVG download
- **WHEN** user clicks "SVG 다운로드" on a version with null `svgUrl`
- **THEN** the button shows a spinner and becomes disabled
- **AND** the server vectorizes the image and returns a Blob URL
- **AND** the browser downloads the file automatically on success
- **AND** the button re-enables

#### Scenario: Cached SVG download
- **WHEN** user clicks "SVG 다운로드" on a version whose `svgUrl` is already set
- **THEN** no API call is made and the browser downloads the existing SVG within ~100ms

#### Scenario: Error UX
- **WHEN** vectorize fails after all retries
- **THEN** the button re-enables and an error toast is shown
- **AND** no partial file is downloaded
