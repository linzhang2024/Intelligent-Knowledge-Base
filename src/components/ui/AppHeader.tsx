"use client";

import Link from "next/link";
import NavTabs, { NavTabKey } from "./NavTabs";
import ActionButtons from "./ActionButtons";

export type ActivePage = NavTabKey;

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

export default function AppHeader({
  activePage,
  title = "智能知识库",
  titleHref = "/dashboard",
  showTabs = true,
  showDashboardLink = true,
  pageActions,
}: AppHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Link
                href={titleHref}
                className="text-lg font-bold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {title}
              </Link>

              {showTabs && (
                <>
                  <span className="text-gray-300">|</span>
                  <NavTabs activeTab={activePage} />
                </>
              )}
            </div>

            <ActionButtons
              onClear={pageActions?.onClear}
              isLoading={pageActions?.isLoading}
              showClear={!!pageActions?.onClear}
              showUpload={true}
              showDashboard={false}
              clearLabel="清空"
              uploadLabel="上传"
              showLabels={true}
            />
          </div>

          <div className="flex items-center space-x-3">
            {showDashboardLink && (
              <ActionButtons
                showClear={false}
                showUpload={false}
                showDashboard={true}
                dashboardLabel="工作台"
                showLabels={true}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
