"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Ground Station",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/missions",
    label: "Missions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-14 bg-gray-950 border-r border-gray-800 flex flex-col items-center py-4 gap-2 flex-shrink-0">
      {NAV_ITEMS.map(item => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition
              ${active
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:text-white hover:bg-gray-800"
              }`}
          >
            {item.icon}
          </Link>
        );
      })}
    </aside>
  );
}