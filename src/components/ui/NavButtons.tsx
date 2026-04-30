"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavButtonsProps {
  showFrontDesk?: boolean;
  showLogout?: boolean;
  frontDeskHref?: string;
  className?: string;
}

export default function NavButtons({
  showFrontDesk = true,
  showLogout = true,
  frontDeskHref = "/dashboard",
  className = "",
}: NavButtonsProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("登出失败:", error);
      router.push("/login");
    }
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {showFrontDesk && (
        <Link
          href={frontDeskHref}
          className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-md text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all duration-200"
        >
          <svg
            className="mr-2"
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
          返回前台
        </Link>
      )}
      {showLogout && (
        <button
          onClick={handleLogout}
          className="inline-flex items-center px-3 py-2 border border-red-200 rounded-md text-sm font-medium text-red-600 bg-white hover:bg-red-50 hover:border-red-300 transition-all duration-200"
        >
          <svg
            className="mr-2"
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
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          退出
        </button>
      )}
    </div>
  );
}
