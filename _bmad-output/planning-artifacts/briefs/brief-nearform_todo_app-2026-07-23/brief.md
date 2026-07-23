---
title: Product Brief — nearform_todo_app
status: final
created: 2026-07-23
updated: 2026-07-23
---

# Product Brief: nearform_todo_app

## Executive Summary

`nearform_todo_app` is a clean, fast, full-stack personal Todo application. It lets an individual manage their own tasks with zero ceremony — open the app, see your list, and add, complete, or delete tasks with updates that feel instant.

The product deliberately resists feature creep. There are no accounts to create, no projects to configure, no onboarding to sit through. The bet is that most task tools are over-built, and a tool that does the core loop — capture, see, complete, clear — with genuine polish is more useful day to day than one with ten features you never touch.

To make the everyday act of checking your list feel a little less mundane, the interface presents your todos floating in space against a slow drift of cube-shaped "stars," rendered in three.js — a small piece of delight layered on top of a fast, reliable core, and never at the expense of it.

## The Problem

Personal task management is a solved problem in theory and a cluttered one in practice. The popular tools optimize for teams, power users, and monetizable features — labels, boards, integrations, reminders, priorities — and the person who just wants to jot down "call the dentist" and tick it off pays a tax in complexity for capabilities they never asked for.

The result is friction at exactly the moment friction hurts most: capture. A task tool that makes you think about *where* something goes, or waits on a spinner, or greets you with an empty dashboard and a setup wizard, is a tool you stop opening. The cost of the status quo is abandoned lists and tasks that live in your head instead.

## The Solution

A minimal but genuinely complete personal task manager:

- **Immediate:** open the app and your list is right there — no login, no onboarding.
- **The core loop:** create a todo (a short description), see it, mark it complete, delete it. Each carries a completion status and creation-time metadata.
- **Legible at a glance:** completed tasks are visually distinct from active ones, so status reads instantly.
- **Responsive and instant-feeling:** updates reflect immediately on add/complete/delete; the UI works well on desktop and mobile.
- **Polished at the edges:** sensible empty, loading, and error states; graceful client- and server-side error handling so failures never break the flow.
- **A touch of delight:** the three.js "todo in space" backdrop, gated behind a `prefers-reduced-motion` / static fallback so it never compromises accessibility or performance.
- **Durable:** a small, well-defined API persists data reliably across refreshes and sessions.

## What Makes This Different

The differentiator is restraint and polish, not novel capability:

- **It does less, better.** The core loop is fast, obvious, and reliable — no feature you have to learn around.
- **Zero friction to start.** No account, no setup; the list is the first and only screen.
- **Delight without cost.** The three.js backdrop makes a mundane tool pleasant to open, at no cost to accessibility or performance.

There is no technical moat here. The advantage is execution: a clean core experience shipped with real quality.

## Who This Serves

- **Primary:** an individual managing their own day-to-day tasks who wants to capture and clear items with no overhead. They value speed and clarity over features. Success for them is opening the app, dumping what's on their mind, and watching the list shrink as the day goes.
- **Future (out of scope now):** the same person once they want to bring in others — shared lists, accounts — which the architecture should leave room for without building today.

## Success Criteria

- A first-time user completes every core action — add, view, complete, delete — with no guidance.
- Interactions feel instantaneous under normal conditions.
- The app is stable across refreshes and sessions; data persists reliably.
- Accessibility holds up: zero critical WCAG AA violations, including with the three.js backdrop active.
- The whole thing runs cleanly from a single `docker-compose up`.

## Scope

**In (v1):**

- CRUD todos (create, view, complete, delete) with creation-time metadata.
- Empty / loading / error states; client- and server-side error handling.
- Responsive desktop + mobile UI.
- three.js floating-in-space backdrop with a reduced-motion / static fallback.
- Small, well-defined CRUD API with durable persistence across sessions.
- Containerized delivery via Docker Compose, runnable with one command.

**Out (explicitly deferred):**

- User accounts, authentication, multi-user, collaboration.
- Task prioritization, deadlines, reminders / notifications.
- Anything the source PRD lists as a future iteration.

The architecture must not *preclude* auth / multi-user later, but must not build it now.

## Technical Shape

Kept light here — the Architecture step owns the real decisions. Direction and known constraints:

- **Backend:** Python + **FastAPI** — small, well-defined CRUD API.
- **Frontend:** modern JS — React + Vite — with **three.js** for the backdrop.
- **Persistence:** **PostgreSQL**, volume-backed, for durability across sessions and to exercise a real multi-container Compose setup.
- **Delivery:** multi-stage Dockerfiles (non-root, health checks), Docker Compose orchestration, health endpoints, dev/test config via env vars / compose profiles.
- **Quality:** unit + integration + E2E (Playwright) test suites with coverage tooling; accessibility held to WCAG AA.

## Vision

If the core lands, the natural growth is *optional* capability that never compromises the frictionless core: accounts and shared lists for people who want them, lightweight due dates, a native or installable-PWA experience. The guiding principle stays the same — the default experience is the fast, quiet, single-screen list, and everything else is something you opt into, not something you wade through.
