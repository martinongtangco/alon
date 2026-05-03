# ADR 0003: Backend Framework Selection

Status: Accepted
Date: 2026-04-19
Accepted: 2026-05-03

## Context
The vibr8.me backend needs to support a minimal surface area as specified in the spec. The backend should:
- Store user profiles and Vibe information  
- Handle Vibe matching algorithm
- Manage anonymized proximity tokens
- Support promo CMS for partner establishments
- Handle event ingestion pipeline (manual curation for MVP)
- Maintain strict privacy standards with no chat infrastructure

The spec doesn't prescribe a specific backend framework, but we need to choose one that supports:
- Minimal API surface area
- Data minimization principles
- Geo-query capabilities for matching
- Scalable yet simple architecture
- Easy deployment and hosting options

## Decision
We will use **Node.js with Express** as the backend framework.

## Alternatives considered
1. **Go with Gin/Gorilla** - More performant but adds complexity for a relatively simple API surface.
2. **Python with FastAPI** - Good for rapid development but might be overkill given the minimal requirements.
3. **Serverless (AWS Lambda, Firebase Functions)** - Could work well but may not provide enough control for our specific needs.
4. **Java Spring Boot** - Overly complex for this application's requirements.

## Consequences
- **Pros**:
  - Well-established ecosystem with extensive documentation
  - Easy to develop and test locally 
  - Good support for REST APIs
  - Can be easily containerized (Docker)
  - Simple deployment options (AWS, Heroku, etc.)
  - Strong community support and third-party libraries
  - Easy integration with database systems
  - Familiar to most developers
- **Cons**:
  - May not be the most performant option for high-volume scenarios
  - Requires more configuration for security and performance tuning
  - Need to implement our own rate limiting and security measures

This choice aligns with the spec's emphasis on minimal surface area. Express provides a lightweight foundation that allows us to build exactly what we need without unnecessary complexity.

## Implementation Notes
- Should use PostgreSQL or MongoDB for data storage (to be decided)
- Will implement strict privacy controls with no user identifiers in proximity tokens
- Must support geo-query capabilities for matching algorithms
- Need to implement proper rate limiting and security measures
- Should be designed for scalability while remaining simple