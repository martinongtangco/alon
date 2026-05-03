# ADR 0002: BLE Library Selection

Status: Accepted
Date: 2026-04-19
Accepted: 2026-05-03

## Context
The vibr8.me app requires a Bluetooth Low Energy (BLE) library that supports both scanning and advertising capabilities on both iOS and Android platforms. The spec mandates that BLE is the primary proximity tool, with strict battery efficiency requirements.

Key constraints:
- Must support both scanning and advertising 
- Must work reliably on both iOS and Android
- Must be compatible with platform-specific background execution models
- Must integrate well with React Native
- Must maintain low power consumption as specified in the Battery Efficiency Strategy

## Decision
We will use **react-native-ble-plx** as the BLE library.

## Alternatives considered
1. **react-native-ble-manager** - Has a good feature set but is more complex and has had some maintenance issues in recent versions.
2. **react-native-ble-android** - Only for Android, doesn't support iOS cross-platform needs.
3. **Native implementation** - Would require significant platform-specific code and maintenance overhead.

## Consequences
- **Pros**:
  - Actively maintained with good community support
  - Cross-platform (iOS + Android) 
  - Supports both scanning and advertising
  - Good TypeScript support
  - Well-documented with examples
  - Integrates smoothly with React Native
  - Active development and bug fixes
- **Cons**:
  - May not have all the advanced features of native libraries
  - Requires careful memory management for continuous scanning
  - Performance may be limited by JavaScript bridge overhead

This library meets our core requirements for both platforms while being well-maintained and documented. It also supports the battery efficiency requirements through its low-level control over BLE operations.

## Implementation Notes
- Need to implement proper background scanning strategies
- Will need platform-specific optimizations for Android OEM restrictions (Samsung, Xiaomi)
- Should leverage the library's built-in handling of connection states and errors