import { FileText } from "lucide-react";

export default function ReportsPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Reports
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          AI-generated research reports and analysis history
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-12 text-center text-zinc-400">
        <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No reports yet</p>
        <p className="text-xs mt-1">
          Go to Stocks page and click "Analyze" on any stock to generate your
          first AI report
        </p>
      </div>
    </div>
  );
}
