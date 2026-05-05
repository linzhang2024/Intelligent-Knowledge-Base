"use client";

import Link from "next/link";

export type ActivePage = "chat" | "report-sql";

interface PageActions {
  onClear?: () => void;
  isLoading?: boolean;
}

interface AppHeaderProps {
  activePage: ActivePage;
  title?: string;
  titleHref?: string;
  showTabs?: boolean;
  showDashboardLink?: boolean;
  pageActions?: PageActions;
}

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

function TrashIcon({ className }: { className?: string }) {
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
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
  );
}

const navTabs = {
  chat: [
    {
      id: "chat" as ActivePage,
      label: "知识库问答",
      activeClass: "text-green-600 bg-green-50",
    },
    {
      id: "report-sql" as ActivePage,
      label: "报表SQL",
      activeClass: "text-gray-500 hover:text-orange-600 hover:bg-orange-50",
      linkHref: "/report-sql",
    },
  ],
  "report-sql": [
    {
      id: "chat" as ActivePage,
      label: "知识库问答",
      activeClass: "text-gray-500 hover:text-orange-600 hover:bg-orange-50",
      linkHref: "/chat",
    },
    {
      id: "report-sql" as ActivePage,
      label: "报表SQL",
      activeClass: "text-indigo-600 bg-indigo-50",
    },
  ],
};

const buttonBaseClass =
  "inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium transition-colors duration-200";

const smallButtonClass =
  "inline-flex items-center px-2 py-1 border rounded text-xs font-medium transition-colors duration-200";

const secondaryButtonClass =
  "border-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-300";

const primaryButtonClass =
  "border-transparent text-white bg-indigo-600 hover:bg-indigo-700";

const dashboardButtonClass =
  "border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900";

const disabledButtonClass = "opacity-50 cursor-not-allowed";

export default function AppHeader({
  activePage,
  title = "智能知识库",
  titleHref = "/dashboard",
  showTabs = true,
  showDashboardLink = true,
  pageActions,
}: AppHeaderProps) {
  const tabs = navTabs[activePage];

  const getTabClasses = (tab: (typeof tabs)[0], isActive: boolean) => {
    if (isActive) {
      return `text-sm font-medium px-2 py-1 rounded transition-colors ${tab.activeClass}`;
    }
    return `text-sm text-gray-500 hover:text-orange-600 px-2 py-1 hover:bg-orange-50 rounded transition-colors`;
  };

  const renderActionButtons = () => {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={pageActions?.onClear}
          disabled={pageActions?.isLoading}
          className={`${smallButtonClass} ${secondaryButtonClass} ${pageActions?.isLoading ? disabledButtonClass : ""}`}
        >
          <TrashIcon className="w-3.5 h-3.5 mr-1" />
          清空对话
        </button>
        <Link
          href="/documents/upload"
          className={`${smallButtonClass} ${primaryButtonClass}`}
        >
          <UploadIcon className="w-3.5 h-3.5 mr-1" />
          上传文档
        </Link>
      </div>
    );
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
                      const content = (
                        <span className={getTabClasses(tab, isActive)}>
                          {tab.label}
                        </span>
                      );

                      if (!isActive && tab.linkHref) {
                        return (
                          <Link key={tab.id} href={tab.linkHref}>
                            {content}
                          </Link>
                        );
                      }

                      return <span key={tab.id}>{content}</span>;
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3">
              {renderActionButtons()}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {showDashboardLink && (
              <Link
                href="/dashboard"
                className={`${buttonBaseClass} ${dashboardButtonClass}`}
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
