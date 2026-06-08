# Aristotle

## Overview

Aristotle is a speed reading web application designed to enhance reading efficiency through RSVP (Rapid Serial Visual Presentation) and Guided Scrolling modes. It supports uploading and managing documents in various formats (PDF, DOCX, EPUB, TXT, Markdown, HTML), offers extensive customization for reading preferences like WPM, font styles, and bionic reading, and provides features such as chapter navigation and free book integration. The project aims to provide a comprehensive and highly customizable reading experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 with shadcn/ui (New York style)
- **State Management**: TanStack React Query for server state, React useState for local state
- **Routing**: Single-page application (no dedicated router)
- **UI/UX**: Focus on customizable reading preferences including WPM, font styling, bionic reading, and pause controls. Features like smooth highlight animations, chapter navigation, and front matter detection enhance the reading experience.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API Style**: RESTful JSON API (`/api/*`)
- **Build**: esbuild for production

### Data Storage
- **Primary Database**: PostgreSQL via Drizzle ORM
- **Client-side Caching**: IndexedDB for documents (`velocityx-docs`), localStorage for user preferences (`aristotle-preferences`, `aristotle-doc-preferences`)
- **Schema**: `shared/schema.ts` with Drizzle-Zod validation
- **Tables**: `documents` (id, title, content, fileType, source, createdAt), `preferences` (WPM, chunk size, font, pause controls)
- **Document Sources**: 'blank' (user-created), 'generated' (demo/Wikipedia), 'upload' (file upload), 'free_book' (from Free Books)

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` are used across frontend and backend.
- **Path Aliases**: `@/` for client/src, `@shared/` for shared/.
- **Storage Abstraction**: `IStorage` interface in `server/storage.ts` for flexible storage implementations.
- **Component Structure**: UI primitives in `components/ui/`, feature-specific components in `components/SpeedReader/`.
- **Text Processing Engines**: `optimizedLayout.ts` for readability, `paragraphRestructure.ts` for comprehension, and `pdf/` for client-side PDF cleanup.

## External Dependencies

### Database
- PostgreSQL
- Drizzle ORM

### File Parsing Libraries
- **pdfjs-dist**: PDF text extraction
- **mammoth**: DOCX parsing
- **epubjs**: EPUB parsing

### UI Libraries
- **shadcn/ui**: Accessible components
- **Framer Motion**: Animations
- **dnd-kit**: Drag and drop
- **react-dropzone**: File uploads

### External APIs
- **Wikipedia API**: Content generation
- **Google Fonts**: Dynamic font loading (Space Grotesk, Inter, JetBrains Mono, Lora, etc.)
- **Free Books APIs**: Multi-source book search and import
  - **Open Library API**: Public domain books
  - **Project Gutenberg**: Classic literature
  - **Internet Archive**: Digital library