// Plain object instead of defineConfig from 'drizzle-kit': the build runs drizzle-kit through npx, where the project's own copy cannot be imported.
export default{dialect:'postgresql',schema:'./db/schema.ts',out:'netlify/database/migrations'}
