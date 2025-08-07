# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **sms-dev**, a local SMS development environment CLI tool (the "Mailtrap for SMS"). It's a TypeScript application that provides a complete local SMS testing environment with both an API server and a web UI for developers to test SMS functionality without real phone numbers or costs.

The project is structured as a monorepo component with the main CLI application in `apps/sms-dev` that depends on separate packages for the API server (`@relay-works/sms-dev-api`), UI (`@relay-works/sms-dev-ui`), and type definitions (`@relay-works/sms-dev-types`).

## Development Commands

### Build and Development
```bash
# Build the project (includes UI build and TypeScript compilation)
npm run build

# Build only the UI assets (copies from ../../../packages/sms-dev-ui)
npm run build:ui

# Development mode with TypeScript watch
npm run dev

# Clean build artifacts
npm run clean

# Prepare for publishing
npm run prepublishOnly
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Clear Jest cache (useful after refactoring)
npx jest --clearCache
```

### Code Quality
```bash
# Lint TypeScript files
npm run lint

# Auto-fix lint issues
npm run lint:fix
```

### CLI Usage
```bash
# Start the CLI locally (after building)
node dist/cli.js start

# Or run built executable
./dist/cli.js start

# Test CLI during development
npm start

# Common CLI operations for testing
sms-dev start --no-ui                    # Start API only
sms-dev start --webhook-url http://localhost:3000/webhook
sms-dev status                           # Check server status
sms-dev config                           # View current configuration
sms-dev mock-phone create --phone +1234567890 --name "Test User"
sms-dev export messages --format json   # Export data
```

## Architecture

### Core Structure
- **CLI Entry Point**: `src/cli.ts` - Commander.js based CLI with comprehensive command structure
- **Commands Directory**: `src/commands/` - Individual CLI command implementations
  - `start.ts` - Server startup logic with port detection and dual server management
  - `stop.ts` - Graceful server shutdown
  - `status.ts` - Server status checking
- **Utilities**: `src/utils/` - Shared utility modules
  - `config.ts` - Simple configuration management for local development (files, env vars, CLI args)
  - `cors.ts` - Simple CORS middleware for local development
  - `uiServer.ts` - UI server wrapper for Next.js assets
  - `performance.ts` - Performance monitoring utilities
  - `platform.ts` - Cross-platform compatibility helpers
  - `security.ts` - Basic security utilities
  - `configValidation.ts` - Simple configuration validation for local dev tool

### Key Dependencies
- **@relay-works/sms-dev-api**: The Express.js API server that handles SMS operations
- **@relay-works/sms-dev-types**: TypeScript definitions shared across packages
- **Commander.js**: CLI framework for command parsing and structure
- **Chalk**: Terminal styling and colors
- **Ora**: Loading spinners for CLI operations

### Server Architecture
The CLI manages two servers concurrently:
1. **API Server** (default port 4001): Express.js server from `@relay-works/sms-dev-api` package
2. **UI Server** (default port 4000): Next.js static assets server for the virtual phone interface

### Configuration System
Multi-layered configuration precedence (highest to lowest):
1. CLI arguments
2. Environment variables (SMS_DEV_* prefix)
3. Configuration files (sms-dev.config.js, sms-dev.config.json, .smsdevrc)
4. Default values

Simple configuration validation appropriate for a local development tool, including basic port range checking (1024-65535) and URL validation for webhooks.

### CLI Command Categories
- **Core**: start, stop, status, config, init, docs
- **Mock Phone Management**: create, list, delete virtual phone numbers
- **Conversation Flows**: create, execute automated message sequences
- **Data Export**: messages and conversations in JSON/CSV
- **Performance Testing**: load testing and statistics

## UI Asset Management

The UI is built separately in the `packages/sms-dev-ui` package as a Next.js application. The build process copies the built assets to `ui-assets/` in this package for distribution. The CLI includes a UIServer utility that serves these static assets.

## Testing Strategy

- **Jest** for unit testing with TypeScript support
- Tests in both `src/` and `tests/` directories
- Coverage collection excluding type definitions and CLI entry point (`src/cli.ts`)
- Test configuration in package.json with custom test patterns
- Tests focus on configuration validation, error handling, and utility functions
- Mock external dependencies like fetch API for CLI command testing

## Code Style

- **TypeScript strict mode** with comprehensive type checking
- **ESLint** with TypeScript-specific rules
- **ES Modules** (type: "module" in package.json)
- Error handling with proper async/await patterns
- Commander.js action handlers with try/catch blocks

## Error Handling

The CLI implements comprehensive error handling:
- Port conflict detection using `detect-port`
- Configuration validation with meaningful error messages
- Graceful shutdown on SIGINT (Ctrl+C)
- Global uncaught exception and unhandled rejection handlers
- Spinner states for long-running operations

## Development Workflow

1. Make changes to source files in `src/`
2. Run `npm run dev` for TypeScript watch mode during development
3. Use `npm run build` to build for testing
4. Test locally with `./dist/cli.js start`
5. Run tests with `npm test`
6. Lint with `npm run lint:fix`

The project follows semantic versioning and includes comprehensive CLI help documentation built into the commands themselves.

## Design Philosophy

SMS-Dev is designed as a **lightweight local development tool** - "the Mailtrap for SMS". The codebase prioritizes:

- **Simplicity over complexity**: Appropriate for single-developer local testing
- **Developer experience**: Easy to understand, configure, and use
- **Minimal dependencies**: Only what's necessary for local development
- **No enterprise features**: No SSL certificates, API keys, or security auditing for localhost

### Recent Refactoring (2025)

The project underwent major refactoring to remove over-engineered enterprise features:

- **Removed**: Complex security framework (SSL/TLS, API keys, security auditing)
- **Removed**: Over-complex validation system (8 categories → 3 simple types)
- **Simplified**: Configuration system for local development use
- **Result**: 10,000+ lines of unnecessary complexity removed

### Validation System

The validation system (`src/validation/index.ts`) is intentionally simple with just 3 core types:
- `validateString()` - For phone numbers, file paths, names, etc.
- `validateNumber()` - For ports, counts, timeouts, etc.
- `validateStructured()` - For URLs, JSON, dates, emails

This covers all CLI validation needs without unnecessary complexity.

## Important Development Notes

### Module System
- Project uses ES modules (`"type": "module"` in package.json)
- All imports use `.js` extensions even for TypeScript files
- Configuration files support both JavaScript and JSON formats

### Port Management
- API server defaults to port 4001
- UI server defaults to port 4000
- Uses `detect-port` for automatic port conflict resolution
- Port validation ensures range 1024-65535

### External Package Dependencies
- **@relay-works/sms-dev-api**: Main API server functionality - imported via `createApiServer()`
- **@relay-works/sms-dev-types**: Shared TypeScript type definitions
- Always use the imported packages rather than implementing SMS logic directly in this CLI

### CLI Command Structure
The CLI uses Commander.js with a comprehensive command structure:
- All commands include proper error handling with try/catch blocks
- Spinner states provide user feedback for long operations
- Commands support both programmatic and interactive usage
- Webhook testing capabilities for integration testing