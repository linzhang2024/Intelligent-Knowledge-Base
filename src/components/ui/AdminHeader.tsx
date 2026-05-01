"use client";

import { usePathname } from "next/navigation";
import BackButton from "./BackButton";
import NavButtons from "./NavButtons";

interface NavItem {
  id: string;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { id: "overview", label: "概览", href: "/admin" },
  { id: "users", label: "用户管理", href: "/admin/users" },
  { id: "documents", label: "文档管理", href: "/admin/documents" },
  { id: "knowledge-bases", label: "知识库管理", href: "/admin/knowledge-bases" },
  { id: "settings", label: "系统设置", href: "/admin/settings" },
];

interface AdminHeaderProps {
  title: string;
  backHref?: string;
  showBackButton?: boolean;
  showFrontDesk?: boolean;
  showLogout?: boolean;
  frontDeskHref?: string;
  showNavMenu?: boolean;
}

export default function AdminHeader({
  title,
  backHref = "/admin",
  showBackButton = true,
  showFrontDesk = true,
  showLogout = true,
  frontDeskHref = "/dashboard",
  showNavMenu = false,
}: AdminHeaderProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 border-b border-gray-100">
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

        {showNavMenu && (
          <nav className="py-3">
            <div className="flex space-x-1 overflow-x-auto">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 whitespace-nowrap ${active ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"}`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
