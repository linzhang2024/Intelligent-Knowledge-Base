"use client";

import BackButton from "./BackButton";
import NavButtons from "./NavButtons";

interface AdminHeaderProps {
  title: string;
  backHref?: string;
  showBackButton?: boolean;
  showFrontDesk?: boolean;
  showLogout?: boolean;
  frontDeskHref?: string;
}

export default function AdminHeader({
  title,
  backHref = "/admin",
  showBackButton = true,
  showFrontDesk = true,
  showLogout = true,
  frontDeskHref = "/dashboard",
}: AdminHeaderProps) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          {showBackButton && (
            <BackButton href={backHref} label="返回管理后台" />
          )}
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        </div>
        <NavButtons
          showFrontDesk={showFrontDesk}
          showLogout={showLogout}
          frontDeskHref={frontDeskHref}
        />
      </div>
    </header>
  );
}
