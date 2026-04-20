## ADDED Requirements

### Requirement: S3 image storage
The system SHALL store all generated and exported images in AWS S3. Bucket key structure: `users/{userId}/projects/{projectId}/logos/{logoId}/{versionId}.png`.

#### Scenario: Upload generated image
- **WHEN** image generation completes
- **THEN** system uploads image to S3 with structured key
- **AND** stores the S3 URL in the LogoVersion record

### Requirement: CloudFront CDN delivery
Images SHALL be served via CloudFront CDN for fast global delivery.

#### Scenario: Image display in gallery
- **WHEN** gallery loads logo images
- **THEN** images are fetched from CloudFront URL (not directly from S3)

### Requirement: Presigned URL for downloads
Export downloads SHALL use presigned S3 URLs with short expiration (1 hour).

#### Scenario: Generate presigned URL
- **WHEN** user requests download of exported file
- **THEN** system generates presigned URL with 1-hour expiry
- **AND** returns URL to client for download