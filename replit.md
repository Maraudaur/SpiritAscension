# Overview

This is a cultivation/spirit-summoning idle game inspired by Asian mythology and martial arts cultivation themes. Players collect and battle with spirits based on Chinese zodiac animals and Wu Xing (five elements), manage a party of spirits, and engage in turn-based battles. The game features an incremental Qi (energy) generation system used to summon new spirits with randomized stats and potential grades.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack**: React 18 with TypeScript, Vite as the build tool, and TailwindCSS for styling.

**UI Framework**: Extensive use of Radix UI primitives (@radix-ui/*) for accessible, unstyled component primitives that are customized with TailwindCSS. Shadcn-style UI components located in `client/src/components/ui/`.

**State Management**: Zustand for client-side state management with persistence middleware. Three main stores:
- `useGameState`: Manages spirits collection, party composition, Qi currency, battle progression, and summoning mechanics
- `useGame`: Handles game phase transitions (ready/playing/ended)
- `useAudio`: Controls audio playback and muting

**Routing**: Single-page application with screen-based navigation managed through React state. No traditional routing library used; navigation handled via conditional rendering in `App.tsx`.

**3D Graphics**: Integration with React Three Fiber (@react-three/fiber) and drei helpers for potential 3D visualization features, though not actively implemented in current screens.

**Design System**: Custom parchment-themed aesthetic with Chinese calligraphy influences. CSS custom properties for theming (parchment colors, vermillion, imperial gold, jade green, azure).

## Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js.

**Build Process**: 
- Client: Vite bundler outputs to `dist/public`
- Server: esbuild bundles server code to `dist/index.js`
- Development: tsx for running TypeScript server directly

**Middleware Strategy**: 
- JSON/URL-encoded body parsing
- Custom request logging for API routes
- Vite dev middleware in development for HMR
- Static file serving in production

**Health Check**: `/health` endpoint returns status information for deployment verification. Responds with status, timestamp, and environment (development/production).

**Production Mode**: Automatically detected using `REPLIT_DEPLOYMENT` environment variable or `NODE_ENV=production`. Server properly handles production builds without attempting to setup Vite dev middleware.

**Error Handling**: Comprehensive error logging with graceful shutdown on startup failures. Error middleware logs errors without crashing the application.

**Storage Layer**: Abstract storage interface (`IStorage`) with in-memory implementation (`MemStorage`). Designed to support future database integration while maintaining clean separation of concerns.

**API Design**: RESTful API with `/api` prefix. Currently minimal implementation - routes registered in `server/routes.ts` but application logic primarily client-side for idle game mechanics.

## Data Storage Solutions

**Database Schema**: Drizzle ORM configured for PostgreSQL (specifically Neon serverless). Schema defined in `shared/schema.ts`:
- Users table with username/password authentication structure
- Migration files output to `./migrations` directory
- Zod integration for runtime validation via drizzle-zod

**Client-Side Persistence**: Zustand persist middleware stores game state in browser localStorage:
- Spirit collection and instances
- Active party composition
- Qi currency and upgrades
- Battle statistics

**Static Game Data**: JSON files in `shared/data/` directory:
- `elements.json`: Five elements (Wood, Earth, Fire, Water, Metal) with properties
- `lineages.json`: Six animal lineages (Tiger, Dragon, Ox, Serpent, Horse, Monkey)
- `skills.json`: Combat abilities with damage/healing values
- `spirits.json`: Base spirit templates organized by rarity tiers

**Data Flow**: Client-heavy architecture where game mechanics run entirely client-side. Server prepared for future features like user authentication, persistent cloud saves, and multiplayer.

## External Dependencies

**Database**: Neon serverless PostgreSQL (@neondatabase/serverless) - cloud-hosted database optimized for serverless deployments.

**ORM/Query Builder**: Drizzle ORM with drizzle-kit for schema management and migrations.

**UI Component Primitives**: Radix UI component library for accessible, unstyled components including dialogs, dropdowns, tooltips, accordions, and form controls.

**3D Rendering**: React Three Fiber ecosystem:
- @react-three/fiber: React renderer for Three.js
- @react-three/drei: Useful helpers and abstractions
- @react-three/postprocessing: Post-processing effects

**Data Fetching**: TanStack Query (@tanstack/react-query) configured with custom fetch utilities in `client/src/lib/queryClient.ts`.

**Styling**: 
- TailwindCSS with PostCSS for utility-first styling
- class-variance-authority (CVA) for component variant management
- clsx and tailwind-merge for className composition

**Development Tools**:
- @replit/vite-plugin-runtime-error-modal for enhanced error display
- vite-plugin-glsl for shader support (prepared for 3D effects)
- tsx for TypeScript execution

**Validation**: Zod for schema validation and type inference, integrated with Drizzle for database schemas.

**Asset Handling**: Vite configured to handle 3D models (.gltf, .glb) and audio files (.mp3, .ogg, .wav).

**Session Management**: connect-pg-simple prepared for PostgreSQL-backed session storage (not yet actively used).