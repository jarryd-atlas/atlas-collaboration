# CHANGELOG

All notable changes to ATLAS Collaborate are documented here.

---

## 2026-03-26

### Meeting Standup – Open Tasks per Customer
- Each customer card in the standup view now shows a collapsible "X open tasks" section
- Tasks sorted by due date (overdue first), showing title, assignee, site, and due date
- Overdue tasks highlighted in red
- Tasks can be completed directly from the standup view with a checkbox
- "View all tasks →" link to navigate to the customer page
- Collapsed by default to keep the UI clean

### HubSpot Deal Type Differentiation
- Deal pills in the Sites list are now color-coded: **orange** for New Business, **blue** (with ↻ icon) for Renewal deals
- Deal type is auto-detected from the HubSpot pipeline stage when linking
- Search dropdown shows a "New Biz" or "Renewal" badge next to each result
- Added `deal_type` column to `hubspot_site_links` table

### Meeting Action Items – @ Mention on Edit
- Editing existing action items now supports `@` mentions for reassigning people and sites
- Same dropdown UI as when creating new action items (People + Sites sections)
- Keyboard navigation (arrow keys, Enter/Tab to select, Escape to dismiss)

### Quick Task Shortcut (⌘;)
- Press `⌘;` from any page to instantly open the Quick Task dialog
- Added a visible "Task ⌘;" button in the top bar next to the search trigger
- Task input auto-focuses on open — start typing immediately
- Existing `⌘J` shortcut still works

### Quick Task – Duplicate Site Chip Fix
- Fixed duplicate site chip appearing in the Quick Task dialog when the page context already provides the site

### HubSpot Inline Deal Linking (Sites List)
- Link/unlink HubSpot deals directly from the Sites list on company pages
- Orange `+` button opens an inline search dropdown with debounced HubSpot search
- Multiple deals can be linked per site
- Deal pills show full name (no truncation) with `×` to unlink

### Site Address Display
- Sites list on company pages now shows the full address instead of just city, state

### Google Docs Picker Improvements
- Search results now show full filenames (wrapping up to 2 lines)
- Document owner and last modified time displayed below each filename
- Relative timestamps (e.g., "3h ago", "2d ago")

### Meeting Action Items – @ Mention Support
- Action items in standups support `@` mentions for assigning people and sites
- Grouped dropdown with Companies, People, and Sites sections
- Dismissible chips for selected assignee/site
- Site ID is threaded through to task creation

### Meeting UI Enhancements
- **Carry-forward badges**: Uncompleted action items from previous days show an amber "carried forward" tag
- **Quick-link icons**: Customer name in meeting cards links directly to the customer page

---

## 2026-03-25

### Meetings Hub
- Built standup meeting management tool for internal CK team
- Create recurring meeting series with team participants
- Add/complete action items per customer per meeting
- Action items auto-create tasks in the ATLAS task system
- Date-based meeting navigation
- Internal-only access (tenant type check)

### Dialog Scroll Fix
- Fixed native `<dialog>` element not responding to clicks after page scroll
- Removed conflicting `fixed` positioning that interfered with browser's top layer

---

## 2026-03-24

### HubSpot Integration
- OAuth connection flow with token management
- Bidirectional field mapping between HubSpot deals and ATLAS sites
- Pipeline stage sync with configurable mappings
- Deal search API for linking deals to sites
- Manual and bulk sync capabilities
- Admin UI for managing field mappings

### Google Docs Integration
- Link Google Drive documents (Docs, Sheets, Slides) to sites
- OAuth2 with Google Identity Services
- Search and link from Google Drive directly
- Document list with type-specific icons and badges

### Voice Notes
- Record voice notes with automatic transcription
- Associate notes with sites and milestones
- Playback and management UI

### Search (⌘K)
- Global search across customers, sites, milestones, and tasks
- Keyboard-navigable results with type-specific icons
- Full-text search powered by PostgreSQL tsvector

### Task System
- Inline task creation with @ mention support (companies, people, sites)
- Task list with filtering, assignment, and status management
- AI-powered task expansion from brief descriptions

### Customer & Site Management
- Customer pages with site lists, pipeline stages, and progress tracking
- Site detail pages with milestones, tasks, and document linking
- Pipeline stage badges and filtering
- Editable "Next Step" field per site

### Flagged Issues
- Flag issues with severity and site association
- Issue tracking with resolution workflow

### Feedback System
- In-app feedback submission dialog
- Admin view for reviewing user feedback

### Notifications
- In-app notification system with dropdown
- Read/unread state management

### Interview System
- Structured interview workflows for site assessments
- AI-powered answer analysis
- Progress tracking per site

### Status Reports
- Generate and manage status reports per customer/site
- Report builder with sections and formatting
