# Run the Vite dev server (HMR) and open it in the browser
run:
    npm run dev -- --open

# Run the engine test suite (every suite runs; failures are listed together at the end)
test:
    npm test

# Validate all content JSON and stop (~0.4s) — the tight loop while authoring
validate:
    npm run validate

# Only the content suites (~4s) — the next loop out from `just validate`
test-content:
    npm run test:content

# Type-check and build for production
build:
    npm run build
