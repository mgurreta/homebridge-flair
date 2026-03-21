# Changelog

## [1.5.1] - 2025-03-20

### Changed
- Declared [Homebridge v2](https://github.com/homebridge/homebridge/wiki/Updating-To-Homebridge-v2.0) support in `engines` and `peerDependencies` using `^1.8.0 || ^2.0.0-beta.0` (covers 2.x stable once released, and current 2.0 betas)
- Aligned Node.js `engines` with supported Homebridge runtimes (`^18.17.0 || ^20.9.0 || ^22.0.0 || ^24.0.0`)
- Enabled TypeScript `skipLibCheck` so the project builds cleanly against Homebridge 2’s transitive dependency typings

## [1.4.0] - 2025-08-13

### Fixed
- **CRITICAL**: Fixed `UnhandledPromiseRejection` error that caused Homebridge crashes when structure is not available
- Improved error handling in `getStructure()` method with proper Error objects instead of string throws
- Added try-catch blocks around accessory configuration to prevent crashes during restore
- Enhanced error logging with descriptive messages

### Changed
- **BREAKING**: Updated Node.js requirements to `^18.17.0 || ^20.9.0 || ^22.0.0` for Homebridge v2.0 compatibility
- **BREAKING**: Updated Homebridge requirements to `^1.8.0 || ^2.0.0-beta.0`
- Updated TypeScript target to ES2022
- Updated TypeScript to v5.0.0
- Updated @types/node to v20.0.0
- Improved error messages to be more user-friendly

### Security
- Fixed potential crash scenarios that could affect Homebridge stability
- Added graceful handling of missing Flair account structures

### Notes
This release addresses the critical stability issue where the plugin would crash Homebridge with "The structure is not available, this should not happen." error. The plugin now handles missing structures gracefully and provides clear error messages to help users diagnose configuration issues.