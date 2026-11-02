import React from "react";

// Inline SVG keeps sidebar icons consistent without a font or external download.
export default function SidebarIcon({ name, className = "" }) {
  const icons = {
    accounts: <><circle cx="12" cy="7" r="4" fill="currentColor" stroke="none" /><path d="M4 21v-2a8 8 0 0 1 16 0v2Z" fill="currentColor" stroke="none" /></>,
    "class-group": <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3M5 5a3 3 0 0 0 0 6M19 5a3 3 0 0 1 0 6M2 20v-3a4 4 0 0 1 3-4M22 20v-3a4 4 0 0 0-3-4" /></>,
    classes: <><circle cx="12" cy="7" r="3" /><path d="M6 21v-3a6 6 0 0 1 12 0v3M5 5a3 3 0 0 0 0 6M19 5a3 3 0 0 1 0 6M2 20v-3a4 4 0 0 1 3-4M22 20v-3a4 4 0 0 0-3-4" /></>,
    courses: <><path d="m2 8 10-5 10 5-10 5ZM6 10v7c4 3 8 3 12 0v-7M22 8v8" /></>,
    assignments: <><path d="M12 22H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9l5 5v5M13 2v6h6M7 12h7M7 16h4M14 19l5-5 3 3-5 5h-3Z" /></>,
    grades: <><rect x="3" y="2" width="18" height="20" rx="2" /><path d="m6 17 3-8 3 8M7 14h4M15 7h3M16.5 11v6M14.5 15h4" /></>,
    learning: <><path d="M3 21V3h6l3 4h9v14ZM6 17l5-5 4 3 5-6" /></>,
    shifts: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    schedules: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M7 2v4M17 2v4M3 10h18M7 14h2M15 14h2M7 18h2M15 18h2" /></>,
    logout: <><path d="M10 3H4v18h6M9 12h13m-5-5 5 5-5 5" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return <svg className={`sidebar-svg ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {icons[name] || icons.assignments}
  </svg>;
}
