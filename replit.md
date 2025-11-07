# Overview

This is a cultivation/spirit-summoning idle game inspired by Asian mythology and martial arts cultivation themes. Players collect and battle with spirits based on Chinese zodiac animals and Wu Xing (five elements), manage a party of spirits, and engage in turn-based battles. The game features an incremental Qi (energy) generation system used to summon new spirits with randomized stats and potential grades.

**UI Design**: PC game interface with persistent left sidebar navigation (100px width) and 16:9 aspect ratio main content container. Persistent HUD at top displays volume control (left), Qi Energy counter with generation rate (center), and screen title (right). Five distinct game screens accessible via icon-driven sidebar buttons: Story (home), Cultivation (incremental loop), Spirit Manager, Summon (gacha), and Battle. Cultivation screen uses three-column layout: Ascension (left), Basic Generators (middle), Advanced Generators (right). Summon and Battle screens are full-page interfaces matching the 16:9 container aesthetic. Story screen features a two-layer system (Story Map + Visual Novel Scene). All screens maintain Xianxia/Chinese Imperial Fantasy aesthetic with parchment textures, vermillion, jade, and gold accents. Navigation between screens handled exclusively via sidebar, with no in-page navigation buttons.

# Recent Changes (November 7, 2025)

## Story Screen Enhancement
- **Interactive Story Nodes**: All available story nodes are now clickable to view or replay content
- **Multiple Dialogues Per Node**: Each story node supports up to 5 different text dialogues that players click through
- **Visual Novel Format**: Dialogue scenes use a visual novel layout with:
  - Upper 2/3 of screen reserved for scene and character visualization
  - Lower 1/3 dialogue box with speaker name, text, and progress indicators
  - Animated dialogue transitions using Framer Motion
- **Encounter Triggers**: Story nodes can trigger battle encounters upon completion via `encounterAfter` flag
- **Sequential Unlocking**: Story nodes unlock sequentially - all previous nodes must be completed before accessing later ones
- **Progress Tracking**: Game state now tracks completed story nodes with persistence across sessions
- **Story Data**: Created `shared/data/story.json` with 5 story nodes including "The Awakening", "First Cultivation", "Spirit Bonding", "The Trial", and "Ancient Wisdom"

## Story-Triggered Battle Flow
- **Battle Source Tracking**: App.tsx now tracks battle origin via `battleSource` state ("story" vs "sidebar")
- **Dual Battle Presentation**: 
  - Story-triggered battles: Full-screen overlay with auto-start functionality
  - Sidebar-triggered battles: Standard full-page layout with manual start
- **Context-Aware Navigation**: 
  - Return buttons dynamically display "Return to Story" or "Return to Cultivation" based on battle source
  - Defeat messages contextually adjust based on origin
- **BattleScreen Props**: Extended with `returnTo` and `autoStart` props for flexible battle presentation
- **Seamless Story Integration**: Completing story nodes with `encounterAfter: true` automatically triggers battle overlay with proper return navigation

# Previous Changes (November 6, 2025)

- Implemented persistent left sidebar navigation with 5 icon buttons (Story, Cultivation, Spirits, Summon, Battle)
- Restructured App.tsx to use sidebar + 16:9 aspect ratio content container layout
- Created Story Screen with two-layer system: Story Map (progression nodes) and Visual Novel Scene (full-screen immersion)
- Updated all screens to work within bounded 16:9 container
- Boss battles now handled via state management instead of separate navigation screen
- **Persistent HUD Implementation**: Added HUD at top of all screens with three sections:
  - Left: Volume control button with slider dropdown
  - Center: Qi Energy counter and generation rate per second
  - Right: Dynamic screen title (Journey, Ascension, Spirit Manager, Summoning, Battle)
- **Cultivation Page Three-Column Layout**: Restructured MainScreen to professional PC game interface:
  - Left Column: Ascension tier progression with buffs and progress tracking
  - Middle Column: "Basic Generators" section containing Qi Upgrades (base production, multiplier) and Battle Mastery
  - Right Column: "Advanced Generators" section (placeholder for future features)
  - Removed summon buttons - moved to dedicated Summon screen
- **Spirit Manager Full-Page Layout**: Restructured to use fixed Left Panel (Active 4-Spirit Party, 320px) and large Main Panel (Scrollable Spirit Inventory with filters) with detailed inspection as Layer 2 modal overlay
- **Summon Screen Full-Page Layout**: Converted from modal popup to full-page 16:9 format:
  - Main summoning circle interface with single and 10x summon buttons
  - Collapsible summoning rates display
  - In-page animated reveal sequences (channeling → revealing → revealed)
  - Post-summon navigation: "Summon Again" or "Return to Cultivation" buttons
- **Battle Screen Full-Page Layout**: Converted from modal popup to full-page 16:9 format:
  - Full-page battle interface with spirit sprites, health bars, and action menu
  - In-page victory/defeat screens with Continue Battling or Return options
  - Removed boss battle concept - all battles are regular cultivation battles
  - Removed all in-page navigation buttons from Cultivation screen (Manage Spirits, Enter Battle, Challenge Boss)
  - Navigation now exclusively via sidebar buttons

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

**Routing**: Single-page application with persistent sidebar navigation. Screen type: `"story" | "cultivation" | "spirits" | "summon" | "battle"`. Navigation handled via Sidebar component and conditional rendering in `App.tsx`. Content displayed in bounded 16:9 aspect ratio container with sidebar always visible on the left.

**3D Graphics**: Integration with React Three Fiber (@react-three/fiber) and drei helpers for potential 3D visualization features, though not actively implemented in current screens.

**Design System**: Custom parchment-themed aesthetic with Chinese calligraphy influences. CSS custom properties for theming (parchment colors, vermillion, imperial gold, jade green, azure). Persistent 100px left sidebar with gradient parchment background. Main content area uses 16:9 aspect ratio container (max-width 1920px) with parchment border and shadow for contained, professional PC game appearance. All interactive buttons feature hover effects (elevation, glow) and tooltips for enhanced UX.

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