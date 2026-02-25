import { UsageDashboard } from "./_components/usage-dashboard";

export default function AdminUsagePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b-3 border-black dark:border-white pb-4">
        <h1 className="font-black text-3xl uppercase tracking-tight">
          Usage Dashboard
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Monitor LLM usage, costs, and budget across your applications
        </p>
      </div>
      <UsageDashboard />
    </div>
  );
}
