# 04. UI/UX Design Brief — PID hcms

## 1. Visual Design Goal

The objective of the PID hcms UI is to provide a premium, modern, glassmorphic dark-mode experience that makes daily HR tasks feel fluid, simple, and clean. The application steers away from traditional default white table formats in favor of a curated, dark-navy cockpit interface that reduces eye strain and groups actions clearly.

---

## 2. Target Users & Personas

1.  **HR & Payroll Managers:** Need dense dashboard widgets, exception warnings, and rapid data-entry interfaces.
2.  **General Employees (ESS):** Need simple, mobile-responsive screens for clock-in, leave requests, and payslip downloads.
3.  **Line Managers:** Need simple review list views to approve leave, regularizations, and appraisals.

---

## 3. Design Principles

*   **Glassmorphism:** Use semi-transparent layers with background blurs to create structural hierarchy.
*   **Micro-Animations:** Enhance inputs, button hover states, and card load behaviors with smooth transition keyframes.
*   **Status Color Coding:** Standardize colors for states: Success (Emerald), Warnings (Amber), Danger (Red), and Info (Cyan/Blue).

---

## 4. Current Style Guide & Design Tokens

The system styles are driven entirely by custom CSS variables in `globals.css`:

### Color Palette
*   `--bg-primary`: `#0a0e1a` (Deep Space Navy)
*   `--bg-secondary`: `#111827` (Charcoal Blue)
*   `--bg-card`: `rgba(255, 255, 255, 0.04)` (Glass Layer)
*   `--border-color`: `rgba(255, 255, 255, 0.08)` (Subtle Boundary)
*   `--accent-blue`: `#182B6D` (PID Navy)
*   `--accent-cyan`: `#00A7B5` (PID Teal)
*   `--accent-gold`: `#FFB23F` (PID Gold)
*   `--success`: `#10b981` (Emerald Green)
*   `--warning`: `#f59e0b` (Amber Orange)
*   `--danger`: `#ef4444` (Crimson Red)

### Typography
*   `font-family`: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
*   Headers use semibold/bold weightings with letter-spacing tracking (`-0.5px`).

### Layout & Spacing
*   Sidebar Width: `260px`
*   Corner Radii: `8px` (`--radius-sm`), `12px` (`--radius-md`), `16px` (`--radius-lg`), `20px` (`--radius-xl`).

---

## 5. UI Component Inventory

1.  **Sidebar Nav:** Fixed left pane with glowing active links (`--gradient-primary`). Includes bottom user avatar container.
2.  **Stat Card Grid:** Floating cards (`.stat-card`) with a top accent color border and hover-translate offsets.
3.  **Data Tables:** Left-aligned columns, uppercase muted headings, and background-tint hover transitions on rows.
4.  **Status Badges:** Rounded capsules (`.badge`) with low-opacity backgrounds (e.g., `.badge-success` uses `rgba(16,185,129,0.15)` background and `#34d399` text).
5.  **Modal Windows:** Centered overlay using `backdrop-filter: blur(8px)` and scaling transition animation.
6.  **Tab Panels:** Sliding capsules for section transitions (e.g., employee details tabs).

---

## 6. UX Issue Review & Recommendations

| Component/Page | Current Behavior | UX Issue | Recommendation | Priority |
| --- | --- | --- | --- | --- |
| **Dashboard** | Generic stats dashboard showing headcount charts. | Lacks clear action focus for employees and managers. | Implement role-based landing views: employee ESS card dashboard vs. Admin cockpit. | High |
| **Forms** | Plain text inputs for PAN, Aadhar, and PF identifiers. | No input masking, leading to typing errors in statutory files. | Add character masks (e.g., `AAAAA1111A` for PAN) and formatting hints. | Medium |
| **Approvals** | Approvals are accessed in individual modules. | Managers must click multiple pages to approve timesheets/leaves. | Implement a unified "Approvals Inbox" tab on the main dashboard. | High |
| **Leave Calendar** | Front-end inputs accept out-of-order dates. | Employees can generate negative leave values. | Add form-level checks checking that `endDate >= startDate`. | Critical |
| **Empty States** | Displays blank sections when tables are empty. | Confusing; users cannot determine if data is loading or missing. | Add structured empty state widgets with helpful labels and icons. | Medium |

---

## 7. Suggested Design Blueprint for Future Version

```
+-----------------------------------------------------------------+
|  PID hcms           [ Q Search Employee... ]   (User Profile)    |
+-----------------------------------------------------------------+
|  (Home)      |                                                  |
|  Employees   |   Welcome Back, Priya!                           |
|  Attendance  |   [ My Quick Punch-In ]   [ Remaining Leaves: 12]|
|  Leave       |                                                  |
|  Payroll     |   +-------------------------------------------+  |
|  Expenses    |   | Pending Team Approvals (3)                |  |
|  Performance |   | - Leave: John Doe (SICK, 2 days)  [Appr]  |  |
|              |   | - Expense: Jane (Travel, ₹1,200)  [Appr]  |  |
|  (Settings)  |   +-------------------------------------------+  |
+--------------+--------------------------------------------------+
```

### Key Elements to Design:
1.  **Guided Employee Form Wizards:** Replace single long forms with step-by-step wizards (Personal details -> Statutory numbers -> Bank info -> Attachments) with auto-saving.
2.  **Interactive Recruitment Kanban:** A visual pipeline where recruiters drag candidate cards across stages (Applied -> Screening -> Interview -> Offer) with automated SLAs.
3.  **Biometric Status Console:** A dedicated admin grid showing biometric device statuses, IP/Lat-long sync success counts, and error alerts.
4.  **Tax Planner Simulator:** An ESS tool allowing employees to toggle between Old and New tax regimes to preview projected TDS deductions.
