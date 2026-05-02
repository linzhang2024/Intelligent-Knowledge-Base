"use client";

import Link from "next/link";
import { ReactNode } from "react";

export type ActivePage = "chat" | "report-sql";

interface NavTab {
  id: string;
  label: string;
  href: string;
  icon?: string;
  activeColor?: string;
}

interface AppHeaderProps {
  activePage: ActivePage;
  title?: string;
  titleHref?: string;
  showTabs?: boolean;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  showDashboardLink?: boolean;
}

const defaultTabs: Record<ActivePage, NavTab[]> = {
  chat: [
    {
      id: "chat",
      label: "知识库问答",
      href: "/chat",
      activeColor: "green",
    },
    {
      id: "report-sql",
      label: "报表SQL",
      href: "/report-sql",
    },
  ],
  "report-sql": [
    {
      id: "chat",
      label: "💬 智能问答",
      href: "/chat",
    },
    {
      id: "report-sql",
      label: "📊 报表SQL",
      href: "/report-sql",
      activeColor: "indigo",
    },
  ],
};

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default function AppHeader({
  activePage,
  title = "智能知识库",
  titleHref = "/dashboard",
  showTabs = true,
  leftActions,
  rightActions,
  showDashboardLink = true,
}: AppHeaderProps) {
  const tabs = defaultTabs[activePage];

  const getTabClasses = (tab: NavTab, isActive: boolean) => {
    if (isActive) {
      const colorClasses: Record<string, string> = {
        green: "text-green-600 bg-green-50",
        indigo: "text-indigo-600 bg-indigo-50",
      };
      return `text-sm font-medium px-2 py-1 rounded transition-colors ${
        colorClasses[tab.activeColor || "green"] || colorClasses.green
      }`;
    }
    return "text-sm text-gray-500 hover:text-orange-600 px-2 py-1 hover:bg-orange-50 rounded transition-colors";
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <Link
                href={titleHref}
                className="text-xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {title}
              </Link>

              {showTabs && tabs.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <div className="flex items-center space-x-1">
                    {tabs.map((tab) => {
                      const isActive = tab.id === activePage;
                      return (
                        <Link
                          key={tab.id}
                          href={tab.href}
                          className={getTabClasses(tab, isActive)}
                        >
                          {tab.label}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {leftActions && (
              <div className="flex items-center space-x-3">{leftActions}</div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {rightActions}

            {showDashboardLink && (
              <Link
                href="/dashboard"
                className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-200"
              >
                <HomeIcon className="mr-2" />
                工作台
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
