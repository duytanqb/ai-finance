import { Activity, FileText, Shield } from "lucide-react";
import Link from "next/link";

const adminSections = [
  {
    name: "Managed Prompts",
    description: "Create, edit, and manage versioned prompts for AI workflows",
    href: "/admin/prompts",
    icon: FileText,
  },
  {
    name: "Usage & Budget",
    description: "Monitor LLM usage, costs, and budget across applications",
    href: "/admin/usage",
    icon: Activity,
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b-3 border-black dark:border-white pb-4">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8" strokeWidth={2.5} />
          <div>
            <h1 className="font-black text-3xl uppercase tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              System administration and monitoring
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {adminSections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group flex items-start gap-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 p-5 transition-colors hover:border-black dark:hover:border-white"
          >
            <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800 p-3">
              <section.icon className="h-6 w-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-bold text-lg uppercase tracking-tight group-hover:underline">
                {section.name}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {section.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
