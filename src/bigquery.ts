import { BigQuery } from '@google-cloud/bigquery'

const PROJECT = process.env.GCP_PROJECT_ID
const DATASET  = process.env.BQ_DATASET || 'decode_tracker'
const TABLE    = process.env.BQ_TABLE   || 'daily_log'

// Fail loudly at startup if GCP_PROJECT_ID is missing
if (!PROJECT) {
  console.error('[fatal] GCP_PROJECT_ID is not set.')
  console.error('        Local  → check your .env file')
  console.error('        Cloud Run → check --set-env-vars in deploy command')
  process.exit(1)
}

const bqConfig: { projectId: string; keyFilename?: string } = { projectId: PROJECT }

if (process.env.GCP_KEY_FILE) {
  bqConfig.keyFilename = process.env.GCP_KEY_FILE
  console.log('[auth] Local mode — using service account key file')
} else {
  console.log('[auth] Cloud Run mode — using ambient credentials (keyless)')
}

export const bigquery = new BigQuery(bqConfig)
export const BQ = { PROJECT, DATASET, TABLE } as const
