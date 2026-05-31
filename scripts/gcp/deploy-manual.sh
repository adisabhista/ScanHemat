#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID.}"
: "${REGION:?Set REGION.}"
: "${SERVICE_NAME:?Set SERVICE_NAME.}"
: "${REPOSITORY:?Set REPOSITORY.}"
: "${RUNTIME_SERVICE_ACCOUNT:?Set RUNTIME_SERVICE_ACCOUNT.}"
: "${CLOUD_SQL_INSTANCE:?Set CLOUD_SQL_INSTANCE.}"
: "${BUCKET_NAME:?Set BUCKET_NAME.}"
: "${NEXTAUTH_URL:?Set NEXTAUTH_URL.}"
: "${GOOGLE_CLOUD_LOCATION:?Set GOOGLE_CLOUD_LOCATION.}"
: "${GOOGLE_DOCUMENT_AI_PROCESSOR_ID:?Set GOOGLE_DOCUMENT_AI_PROCESSOR_ID.}"

TAG="${TAG:-manual}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/scanhemat:${TAG}"
MIGRATION_IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/scanhemat-migrations:${TAG}"

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
docker build --target runner --tag "$IMAGE" .
docker build --target migration-runner --tag "$MIGRATION_IMAGE" .
docker push "$IMAGE"
docker push "$MIGRATION_IMAGE"

gcloud run jobs deploy "${SERVICE_NAME}-migrate" \
  --image "$MIGRATION_IMAGE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
  --set-secrets "DATABASE_URL=scanhemat-database-url:latest" \
  --quiet

gcloud run jobs execute "${SERVICE_NAME}-migrate" --project "$PROJECT_ID" --region "$REGION" --wait --quiet

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-cloudsql-instances "$CLOUD_SQL_INSTANCE" \
  --allow-unauthenticated \
  --set-env-vars "NEXTAUTH_URL=${NEXTAUTH_URL},MAX_RECEIPT_UPLOAD_MB=8,OCR_PROVIDER=google-document-ai,GOOGLE_CLOUD_PROJECT_ID=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION},GOOGLE_DOCUMENT_AI_PROCESSOR_ID=${GOOGLE_DOCUMENT_AI_PROCESSOR_ID},AI_GENERATION_PROVIDER=gemini-api,GEMINI_RECEIPT_MODEL=gemini-3.5-flash,GEMINI_ASSISTANT_MODEL=gemini-3.5-flash,GEMINI_VISION_MODEL=gemini-3.5-flash,GEMINI_FALLBACK_MODEL=gemini-2.5-flash,RECEIPT_EXTRACTION_STRATEGY=hybrid,RECEIPT_STORAGE_PROVIDER=gcs,GCS_RECEIPT_BUCKET=${BUCKET_NAME}" \
  --set-secrets "DATABASE_URL=scanhemat-database-url:latest,NEXTAUTH_SECRET=scanhemat-nextauth-secret:latest,GEMINI_API_KEY=scanhemat-gemini-api-key:latest" \
  --quiet
