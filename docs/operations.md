# Operations

Use Node 22 and pnpm 9.15.0. Copy `.env.example` to `.env`, configure infrastructure endpoints, then run `pnpm infra:up`.

Run the deterministic offline lineage fixture with `pnpm tsx scripts/run-pilot.ts --pilot rome-ja`. It writes `out/rome-ja.publishing-package.json`; this validates artifact provenance and cache behavior without provider credentials.

For a real provider-backed project, start the API and worker, submit a project through the Studio, approve the enabled script, image, and render gates as needed, then use the stage command endpoint to retry a single failed image/audio child. Resume from the failed stage only after its child artifact is approved; completed siblings remain intact.
