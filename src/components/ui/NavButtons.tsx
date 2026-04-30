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
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-green-200 bg-white text-green-600 hover:bg-green-50 hover:border-green-300 hover:scale-105 transition-all duration-200"
          aria-label="前台"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        </Link>
      )}
      {showLogout && (
        <button
          onClick={handleLogout}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 hover:scale-105 transition-all duration-200"
          aria-label="退出"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
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
        </button>
      )}
    </div>
  );
}
