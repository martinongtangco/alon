# ADR 0001: State Management Library Selection

Status: Accepted
Date: 2026-04-19
Accepted: 2026-05-03

## Context
The Alon app requires a state management solution that fits the spec's passive/ambient model. The app needs to manage:
- User profile and settings
- Proximity events and compatibility scores  
- Active connections and notifications
- UI state for multiple screens
- Background service states

The system architecture overview mentions that state management is yet to be chosen, but it should align with React Native's component model and the passive nature of the app.

## Decision
We will use **Zustand** as the state management library.

## Alternatives considered
1. **Redux Toolkit** - More complex setup and boilerplate for this use case. Overkill for a relatively simple state model.
2. **Jotai** - Very flexible but introduces complexity with atom-based system that might not be needed for this app's requirements.
3. **MobX** - Good for reactive programming but adds significant overhead and complexity for this specific use case.

## Consequences
- **Pros**: 
  - Lightweight and easy to use
  - Works well with React Native's component model
  - Minimal boilerplate code
  - Easy to integrate with TypeScript
  - Supports middleware for persistence/debugging
- **Cons**:
  - Less established than Redux in large-scale applications
  - May need additional tooling for complex state interactions

This choice aligns well with the passive/ambient nature of the app, where we don't need complex state synchronization but rather simple, reactive state updates across components.