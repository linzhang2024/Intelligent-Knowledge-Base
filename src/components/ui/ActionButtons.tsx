"use client";

import Link from "next/link";

interface ClearButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
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

export function ClearButton({
  onClick,
  disabled = false,
  label = "清空",
  showLabel = true,
}: ClearButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border transition-all duration-200 ${
        disabled
          ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
          : "border-gray-200 bg-white text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
      }`}
    >
      <TrashIcon className="w-4 h-4" />
      {showLabel && <span>{label}</span>}
    </button>
  );
}

interface UploadButtonProps {
  href?: string;
  label?: string;
  showLabel?: boolean;
}

export function UploadButton({
  href = "/documents/upload",
  label = "上传",
  showLabel = true,
}: UploadButtonProps) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-transparent bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200"
    >
      <UploadIcon className="w-4 h-4" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}

interface DashboardButtonProps {
  href?: string;
  label?: string;
  showLabel?: boolean;
}

export function DashboardButton({
  href = "/dashboard",
  label = "工作台",
  showLabel = true,
}: DashboardButtonProps) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200"
    >
      <HomeIcon className="w-4 h-4" />
      {showLabel && <span>{label}</span>}
    </Link>
  );
}

interface ActionButtonsProps {
  onClear?: () => void;
  isLoading?: boolean;
  showClear?: boolean;
  showUpload?: boolean;
  showDashboard?: boolean;
  clearLabel?: string;
  uploadLabel?: string;
  dashboardLabel?: string;
  uploadHref?: string;
  dashboardHref?: string;
  showLabels?: boolean;
}

export default function ActionButtons({
  onClear,
  isLoading = false,
  showClear = true,
  showUpload = true,
  showDashboard = false,
  clearLabel = "清空",
  uploadLabel = "上传",
  dashboardLabel = "工作台",
  uploadHref = "/documents/upload",
  dashboardHref = "/dashboard",
  showLabels = true,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center space-x-2">
      {showClear && onClear && (
        <ClearButton
          onClick={onClear}
          disabled={isLoading}
          label={clearLabel}
          showLabel={showLabels}
        />
      )}
      {showUpload && (
        <UploadButton href={uploadHref} label={uploadLabel} showLabel={showLabels} />
      )}
      {showDashboard && (
        <DashboardButton
          href={dashboardHref}
          label={dashboardLabel}
          showLabel={showLabels}
        />
      )}
    </div>
  );
}
