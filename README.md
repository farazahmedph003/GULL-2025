# GULL - Accounting Management System

> **G**eneral **U**tility for **L**edger and **L**ogs

A specialized accounting management system designed for tracking and analyzing numerical data across different digit categories (2-digit "Akra" and 3-digit "Ring" entries).

## 🎯 Features

### Core Functionality
- **Project-Based Organization**: Create and manage multiple accounting projects
- **Dual-Category Entry System**: Support for 2-digit (00-99) and 3-digit (000-999) entries
- **Transaction Management**: Add, edit, delete, and track transactions with timestamps
- **Advanced Filtering**: Complex filters with mathematical operators
- **Real-time Calculations**: Automatic totaling and summary calculations
- **Data Export/Import**: Excel file support for data portability
- **Undo/Redo System**: Complete action history with revert capabilities
- **Visual Analytics**: Bar charts and visual data representations
- **Theme Support**: Light and dark mode with persistent preferences

### Technical Features
- Progressive Web App (PWA) with offline capabilities
- Real-time data synchronization
- Responsive design for all screen sizes
- Keyboard navigation support
- Full TypeScript type safety

## 🎨 Design System

This project includes a comprehensive design system in `design-system.json` that defines:
- Color palettes (light mode optimized)
- Typography scales
- Component styling
- Spacing and layout
- Shadows and effects

### Using the Design System with AI

Reference the design system in your prompts to Cursor/AI:

```
"Use the design system defined in design-system.json to create a new stats card component"
```

```
"Apply the card component styling from design-system.json to this element"
```

```
"Ensure this follows the color palette and typography from our design system"
```

The design system ensures visual consistency across all components and provides AI with exact specifications for styling.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (for authentication and database)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd FRAZ
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The production-ready files will be in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework with hooks and functional components
- **TypeScript** - Type-safe JavaScript
- **Vite 7** - Next-generation build tool
- **Tailwind CSS v4** - Utility-first CSS framework
- **React Router DOM** - Client-side routing

### Backend (Coming in Phase 6)
- **Supabase** - Authentication, database, and real-time sync
- **PostgreSQL** - Relational database
- **Row Level Security** - Data access control

### Additional Tools
- **Vite PWA Plugin** - Progressive Web App capabilities
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## 📁 Project Structure

```
FRAZ/
├── src/
│   ├── components/       # Reusable UI components
│   ├── contexts/         # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Page components
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main app component
│   ├── index.css         # Global styles
│   └── main.tsx          # App entry point
├── public/               # Static assets
├── dist/                 # Production build output
├── index.html            # HTML template
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Dependencies and scripts
```

## 🎨 Design System

### Color Palette
- **Primary**: #1e293b (Deep slate blue)
- **Secondary**: #0891b2 (Cyan blue)
- **Accent**: #38bdf8 (Sky blue)
- **Success**: #22c55e (Green)
- **Warning**: #facc15 (Yellow)
- **Danger**: #ef4444 (Red)

### Typography
- **Font Family**: Inter
- **Weights**: 400 (Regular), 500 (Medium), 600 (Semi-bold), 700 (Bold)
- **Monospace**: Monaco, Consolas (for numerical data)

### Custom CSS Classes
```css
.btn-primary      /* Primary action button */
.btn-secondary    /* Secondary action button */
.btn-danger       /* Destructive action button */
.card             /* Card container */
.input-field      /* Form input field */
```

## 🔄 Development Phases

### ✅ Phase 1: Core Project Structure & Basic Navigation
- [x] Project setup with Vite, React, TypeScript
- [x] Tailwind CSS v4 configuration
- [x] Core components (Layout, Theme, Navigation)
- [x] Routing system
- [x] Project selection page
- [x] Local storage implementation

### ✅ Phase 2: Main Dashboard & Entry Management
- [x] Dashboard interface with statistics
- [x] Entry management panel (sliding from right)
- [x] Standard and Intelligent entry tabs
- [x] History panel (sliding from left)
- [x] Floating action buttons
- [x] Transaction processing and state management
- [x] Undo/redo system
- [x] Real-time calculations
- [x] Keyboard shortcuts

### ✅ Phase 3: Akra & Ring Pages
- [x] Number grid displays (00-99, 000-999)
- [x] Filter and calculate tabs
- [x] Color-coded number boxes (green/yellow/red/white)
- [x] Transaction history modal with bar charts
- [x] Search and filter functionality with wildcards
- [x] Selection mode with bulk operations
- [x] CSV export functionality

### ✅ Phase 4: Advanced Filtering & Transaction History
- [x] Advanced search with 12+ command patterns
- [x] Transaction editing functionality
- [x] Bulk operations (delete selected)
- [x] Chart image export (PNG)
- [x] Saved filter presets
- [x] Pattern validation and suggestions
- [x] Copy and CSV export features

### ✅ Phase 5: Authentication
- [x] Supabase authentication integration
- [x] Email/password sign up and sign in
- [x] Anonymous user support (guest mode)
- [x] Session persistence & token management
- [x] User profile management
- [x] Protected routes with auth guards
- [x] Offline mode support

### ✅ Phase 6: Database Schema & API Integration
- [x] Complete database schema design
- [x] Supabase migration files
- [x] Row-Level Security (RLS) policies
- [x] Database service layer
- [x] Real-time sync integration
- [x] Offline/online mode handling

### ✅ Phase 7: File Handling & Third-party Integrations
- [x] Excel import with validation
- [x] Excel export with formatting
- [x] HTML2Canvas chart export
- [x] Tone.js audio feedback
- [x] Clipboard operations
- [x] CSV export alternative

### ✅ Phase 8: Performance, Testing & Documentation
- [x] Performance optimization utilities
- [x] Error handling system
- [x] Comprehensive testing guide
- [x] Deployment guide (4 platforms)
- [x] Production readiness checklist

---

## 🎊 ALL PHASES COMPLETE! 🎊

The GULL Accounting Management System is now **production-ready** with all 8 phases successfully implemented!
- [ ] Error handling

### 📋 Phase 7: File Handling & Integrations
- [ ] Excel import/export
- [ ] Offline capabilities
- [ ] Audio feedback
- [ ] Performance optimization

### 📋 Phase 8: Testing & Optimization
- [ ] Comprehensive testing
- [ ] Security review
- [ ] Performance optimization
- [ ] Documentation

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint (when configured)

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📱 PWA Features

- Install as standalone app
- Offline functionality (coming in Phase 7)
- Service worker caching
- App manifest configured
- Mobile-responsive design

## 🤝 Contributing

This is a custom-built application. For feature requests or bug reports, please contact the development team.

## 📄 License

Proprietary - All rights reserved

## 📞 Support

For support or questions, please contact the project maintainers.

---

**Current Version**: All Phases Complete (Production Ready!)  
**Last Updated**: October 2025  
**Status**: ✅ Production Ready
# NEW-GULL
# NEW-GULL
