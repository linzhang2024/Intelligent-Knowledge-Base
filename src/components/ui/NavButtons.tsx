"use client";

import Link from "next/link";
import LogoutButton from "./LogoutButton";

interface NavButtonsProps {
  showFrontDesk?: boolean;
  showLogout?: boolean;
  frontDeskHref?: string;
  className?: string;
  iconOnly?: boolean;
}

export default function NavButtons({
  showFrontDesk = true,
  showLogout = true,
  frontDeskHref = "/dashboard",
  className = "",
  iconOnly = false,
}: NavButtonsProps) {
  if (iconOnly) {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        {showFrontDesk && (
          <Link
            href={frontDeskHref}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 hover:scale-105 transition-all duration-200"
            title="返回前台"
            aria-label="返回前台"
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Link>
        )}
        {showLogout && <LogoutButton iconOnly={true} />}
      </div>
    );
  }

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
      {showLogout && <LogoutButton />}
    </div>
  );
}
