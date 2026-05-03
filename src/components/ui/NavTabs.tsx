"use client";

import Link from "next/link";

export type NavTabKey = "chat" | "report-sql";

interface NavTabItem {
  key: NavTabKey;
  label: string;
  href?: string;
  icon?: string;
}

interface NavTabsProps {
  activeTab: NavTabKey;
  tabs?: NavTabItem[];
  showUploadButton?: boolean;
  className?: string;
}

const defaultTabs: NavTabItem[] = [
  { key: "chat", label: "知识库问答", href: "/chat", icon: "💬" },
  { key: "report-sql", label: "报表SQL", href: "/report-sql", icon: "📊" },
];

function getTabClasses(isActive: boolean, key: NavTabKey) {
  if (isActive) {
    switch (key) {
      case "chat":
        return "bg-green-50 text-green-700 border-green-200";
      case "report-sql":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  }
  return "bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700 hover:border-gray-300";
}

export default function NavTabs({
  activeTab,
  tabs = defaultTabs,
  className = "",
}: NavTabsProps) {
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const baseClasses =
          "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md border transition-all duration-200";
        const tabClasses = getTabClasses(isActive, tab.key);

        const content = (
          <span className={`${baseClasses} ${tabClasses}`}>
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
          </span>
        );

        if (!isActive && tab.href) {
          return (
            <Link key={tab.key} href={tab.href} className="cursor-pointer">
              {content}
            </Link>
          );
        }

        return <span key={tab.key}>{content}</span>;
      })}
    </div>
  );
}
