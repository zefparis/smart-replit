import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Menu, Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
      <div className="flex h-16 items-center justify-between px-2 sm:px-4 lg:px-6 min-w-0">
        {/* Left side */}
        <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden rounded-md p-2 h-8 w-8 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 flex-shrink-0"
            data-testid="button-menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Search */}
          <div className="hidden md:flex relative flex-1 max-w-md lg:max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search..."
              className="pl-10 w-full"
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Mobile search button */}
          <Button variant="ghost" size="sm" className="md:hidden p-2 h-8 w-8" data-testid="button-mobile-search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="p-2 h-8 w-8 sm:h-9 sm:w-9" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <div className="ml-1">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}