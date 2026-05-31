# ScanHemat Deployment on Google Cloud Platform

## Architecture

ScanHemat runs as a public Cloud Run web service with NextAuth application authentication. It connects to Cloud SQL PostgreSQL, stores private receipt files in Google Cloud Storage, sends OCR requests to Google Document AI with the Cloud Run runtime service account, and sends generation requests to the Gemini API with a Secret Manager API key. Vertex AI remains an optional generation provider.

Production receipt objects are private and use this layout:

```text
receipts/{userId}/{receiptId}/{uuid}-{safeFileName}
```

Clients retrieve previews through authenticated application routes. Raw GCS paths are never exposed to the browser.

## Required Services

Enable:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  documentai.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com
```

Enable `aiplatform.googleapis.com` only when using the optional Vertex AI generation provider.

Create the Artifact Registry Docker repository used by CI/CD:

```bash
gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION"
```

## Environment Variables

Cloud Run receives non-secret configuration as environment variables:

```text
NEXTAUTH_URL
MAX_RECEIPT_UPLOAD_MB
OCR_PROVIDER
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_CLOUD_LOCATION
GOOGLE_DOCUMENT_AI_PROCESSOR_ID
AI_GENERATION_PROVIDER
GEMINI_RECEIPT_MODEL
GEMINI_ASSISTANT_MODEL
GEMINI_VISION_MODEL
GEMINI_FALLBACK_MODEL
RECEIPT_EXTRACTION_STRATEGY
RECEIPT_STORAGE_PROVIDER
GCS_RECEIPT_BUCKET
APP_VERSION
```

Cloud Run receives these secrets from Secret Manager:

```text
DATABASE_URL
NEXTAUTH_SECRET
GEMINI_API_KEY
```

Use `NEXTAUTH_URL=https://YOUR_CLOUD_RUN_URL`. Generate a random `NEXTAUTH_SECRET` with at least 32 characters. Do not set `GOOGLE_APPLICATION_CREDENTIALS` in Cloud Run. Application Default Credentials use the attached runtime service account.

For local development, copy `.env.example` to `.env.local`, use `RECEIPT_STORAGE_PROVIDER=local`, and optionally set `GOOGLE_APPLICATION_CREDENTIALS` to a local service-account JSON path. Never commit that file.

## Cloud SQL PostgreSQL

Create a PostgreSQL instance, database, and application user:

```bash
gcloud sql instances create scanhemat-postgres --database-version=POSTGRES_16 --region="$REGION"
gcloud sql databases create scanhemat --instance=scanhemat-postgres
gcloud sql users create scanhemat_app --instance=scanhemat-postgres --password="REPLACE_ME"
```

Prefer private IP or the Cloud SQL connection attached to Cloud Run. Supported URLs:

```text
postgresql://USER:PASSWORD@HOST:5432/scanhemat?schema=public
postgresql://USER:PASSWORD@localhost/scanhemat?host=/cloudsql/PROJECT:REGION:INSTANCE&schema=public
```

Store the final URL as `scanhemat-database-url` in Secret Manager. The deployment workflow runs `prisma migrate deploy` through a dedicated Cloud Run Job before updating the web service.

## Private GCS Bucket

Create a regional bucket with public access prevention:

```bash
gcloud storage buckets create "gs://$BUCKET_NAME" --location="$REGION" --uniform-bucket-level-access
gcloud storage buckets update "gs://$BUCKET_NAME" --public-access-prevention
```

Grant the runtime service account `roles/storage.objectUser` on the bucket. The health probe lists at most one object to verify access with that role. Do not make receipt objects public.

## Secret Manager

Create secret containers:

```bash
PROJECT_ID="$PROJECT_ID" bash scripts/gcp/create-secrets.sh
```

Add values without storing them in shell history where possible:

```bash
printf '%s' "$DATABASE_URL" | gcloud secrets versions add scanhemat-database-url --data-file=-
printf '%s' "$NEXTAUTH_SECRET" | gcloud secrets versions add scanhemat-nextauth-secret --data-file=-
printf '%s' "$GEMINI_API_KEY" | gcloud secrets versions add scanhemat-gemini-api-key --data-file=-
```

## IAM

Runtime service account:

```text
roles/cloudsql.client
roles/secretmanager.secretAccessor
roles/storage.objectUser on the receipt bucket
Document AI processor invocation permission, commonly roles/documentai.apiUser
roles/logging.logWriter
```

Deployment service account used by GitHub Actions:

```text
roles/run.admin
roles/artifactregistry.writer
roles/iam.serviceAccountUser on the runtime service account
roles/cloudsql.client
roles/secretmanager.secretAccessor
```

Keep grants scoped to the project, service account, bucket, and secrets where possible.

## GitHub Actions Configuration

Configure Workload Identity Federation for GitHub Actions, then add these repository variables:

```text
GCP_PROJECT_ID
GCP_REGION
CLOUD_RUN_SERVICE
CLOUD_RUN_SERVICE_ACCOUNT
CLOUD_SQL_INSTANCE
ARTIFACT_REGISTRY_REPOSITORY
GCS_RECEIPT_BUCKET
GCP_WORKLOAD_IDENTITY_PROVIDER
GCP_SERVICE_ACCOUNT
NEXTAUTH_URL
GOOGLE_CLOUD_LOCATION
GOOGLE_DOCUMENT_AI_PROCESSOR_ID
```

`CLOUD_SQL_INSTANCE` uses `PROJECT:REGION:INSTANCE`. `NEXTAUTH_URL` must use the deployed HTTPS URL. No Google JSON key is required in GitHub.

Add each value as a separate repository variable. Do not paste the full configuration block into one variable. The deploy preflight fails before authentication and names any missing or malformed variable.

`.github/workflows/ci.yml` runs Prisma generation, type checking, linting, tests, and the Next build without calling real Google APIs. `.github/workflows/deploy-gcp.yml` authenticates through Workload Identity Federation, pushes app and migration images to Artifact Registry, runs the Cloud Run migration job, and deploys the service only after migrations succeed.

## Manual Deployment

Set the required shell variables and run:

```bash
bash scripts/gcp/deploy-manual.sh
```

The script builds and pushes both Docker targets, deploys the migration job, executes migrations, and deploys Cloud Run. It does not create infrastructure or secret versions.

For local verification:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
npm.cmd run build
docker build --target runner -t scanhemat:local .
docker build --target migration-runner -t scanhemat:migrate-local .
```

Diagnostics remain manual:

```powershell
npm.cmd run ocr:diagnose -- "path-to-receipt.pdf"
npm.cmd run ai:diagnose -- "path-to-ocr-text.txt"
npm.cmd run ai:vision-diagnose -- "path-to-receipt.jpg"
```

## Monitoring And Rate Limits

Use `GET /api/health` for monitoring. It performs a lightweight database query and storage reachability check without calling Document AI or Gemini.

The application enforces MVP in-memory per-user limits:

```text
Receipt upload: 20/hour
Assistant chat: 60/hour
Vision verification: 20/hour
```

These limits are per Cloud Run instance. Replace them with Memorystore Redis or enforce broader protection through Cloud Armor before scaling to multiple instances or handling hostile traffic.

## Troubleshooting

- Prisma cannot connect to Cloud SQL: confirm `DATABASE_URL`, the Cloud SQL attachment, `roles/cloudsql.client`, and the socket instance name.
- Workload Identity authentication fails before Docker build: confirm `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` are separate repository variables. `GCP_WORKLOAD_IDENTITY_PROVIDER` must use `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER`.
- Migration job exits with code `127`: confirm the job image was built from the Docker `migration-runner` target. The app `runner` image intentionally does not include `npm`.
- PostgreSQL reports `public.User does not exist`: migrations did not complete. Run `gcloud run jobs executions list --job scanhemat-migrate --region "$REGION"` and inspect the latest execution.
- Prisma client is missing during build: run `npm run prisma:generate`; both Docker targets already do this.
- Document AI permission is denied: confirm the processor project, location, ID, API enablement, and runtime service-account Document AI role.
- Document AI authentication fails locally: set a readable `GOOGLE_APPLICATION_CREDENTIALS` path. In Cloud Run, confirm the attached runtime service account instead.
- Gemini reports missing configuration: add a current `scanhemat-gemini-api-key` secret version and confirm the Cloud Run secret mapping.
- GCS bucket access is denied: confirm `GCS_RECEIPT_BUCKET`, private bucket existence, and bucket-scoped `roles/storage.objectUser`.
- Health storage check is denied: confirm the runtime service account can list objects in the receipt bucket.
- Login redirects incorrectly: set `NEXTAUTH_URL` to the exact deployed HTTPS origin.
- Cloud Run cold starts are noticeable: configure a minimum instance count after measuring traffic and cost.
