import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  Brain,
  Bot,
  Settings,
  Users,
  FileText,
  X,
  TrendingUp,
  Zap,
  Wifi,
  Key,
  Package,
  Coins,
} from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Finance", href: "/finance", icon: DollarSign },

  { name: "Cash Machine", href: "/monetization", icon: TrendingUp },
  { name: "IAS Rewards", href: "/ias", icon: Coins },
  { name: "IAS Admin", href: "/ias/admin", icon: Settings },
  { name: "AliExpress", href: "/aliexpress", icon: Package },
  { name: "Connecteurs", href: "/channels-config", icon: Wifi },
  { name: "Clés API", href: "/api-keys-config", icon: Key },
  { name: "AI Monitoring", href: "/ai-monitoring", icon: Brain },
  { name: "DG AI Supervisor", href: "/dg-ai-supervisor", icon: Zap },
  { name: "Scrapers", href: "/scrapers", icon: Bot },

  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Users", href: "/users", icon: Users },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <>
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-60 sm:w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out lg:relative lg:transform-none",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header */}
          <div className="flex h-16 items-center justify-between px-3 sm:px-4 border-b border-gray-200 dark:border-gray-700">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              SmartLinks
            </h1>
            <button
              onClick={onClose}
              className="lg:hidden rounded-md p-2 h-8 w-8 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 flex-shrink-0"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors min-h-[2.5rem]",
                    isActive
                      ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  data-testid={`link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0",
                      isActive
                        ? "text-blue-500"
                        : "text-gray-400 group-hover:text-gray-500"
                    )}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}