"use client";

import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  className?: string;
  iconOnly?: boolean;
}

export default function LogoutButton({ className = "", iconOnly = false }: LogoutButtonProps) {
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

  if (iconOnly) {
    return (
      <button
        onClick={handleLogout}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 hover:border-red-300 hover:scale-105 transition-all duration-200 ${className}`}
        title="退出登录"
        aria-label="退出登录"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
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
    );
  }

  return (
    <button
      onClick={handleLogout}
      className={`inline-flex items-center px-3 py-2 border border-red-200 rounded-md text-sm font-medium text-red-600 bg-white hover:bg-red-50 hover:border-red-300 transition-all duration-200 ${className}`}
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
  );
}
