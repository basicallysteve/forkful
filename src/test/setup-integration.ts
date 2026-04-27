import { config } from 'dotenv'

// Load local environment variables for all integration tests before they run
config({ path: '.env.local' })