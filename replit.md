# Overview

This project is an idle game inspired by Asian mythology, focusing on cultivation and spirit summoning. Players collect, manage, and battle with spirits based on Chinese zodiac and Wu Xing elements. The game features an incremental Qi generation system for summoning spirits with randomized stats and potential grades. The UI is designed for a PC game interface with a persistent left sidebar and a 16:9 aspect ratio main content area, all adhering to a Xianxia/Chinese Imperial Fantasy aesthetic. The game aims to provide a rich, engaging experience with strategic spirit management and turn-based combat.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend uses React 18 with TypeScript, Vite, and TailwindCSS. It leverages Radix UI for accessible components and Zustand for client-side state management, including persistence in localStorage for game state, Qi currency, and battle progression. Navigation is handled via a persistent sidebar, rendering different screens within a 16:9 aspect ratio container. The design system features a custom parchment theme with Chinese calligraphy influences, using CSS custom properties for theming. React Three Fiber is integrated for potential future 3D visualizations.

## Backend Architecture

The backend is built with Express.js and TypeScript, running on Node.js. It uses esbuild for server bundling and tsx for development. Key features include JSON/URL-encoded body parsing, custom request logging, and static file serving. It has a `/health` endpoint for deployment verification and robust error handling. A minimalist API design focuses on client-side game mechanics, with an abstract storage interface (`IStorage`) designed for future database integration.

## Data Storage Solutions

Drizzle ORM is configured for PostgreSQL (Neon serverless) with a schema defined in `shared/schema.ts` for user authentication. Client-side game state, including spirit collections, party composition, and Qi, is persisted in browser localStorage via Zustand. Static game data, such as elements, lineages, skills, and base spirit templates, is stored in JSON files within the `shared/data/` directory.

# External Dependencies

-   **Database**: Neon serverless PostgreSQL, accessed via Drizzle ORM and drizzle-kit.
-   **UI Component Primitives**: Radix UI for accessible, unstyled components.
-   **3D Rendering**: React Three Fiber ecosystem (`@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`).
-   **Data Fetching**: TanStack Query (`@tanstack/react-query`).
-   **Styling**: TailwindCSS, class-variance-authority (CVA), clsx, and tailwind-merge.
-   **Development Tools**: `@replit/vite-plugin-runtime-error-modal`, `vite-plugin-glsl`, `tsx`.
-   **Validation**: Zod for schema validation.
-   **Asset Handling**: Vite for 3D models and audio files.
-   **Session Management**: `connect-pg-simple` (prepared for use).