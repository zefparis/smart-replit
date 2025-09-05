import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: "increase" | "decrease" | "neutral";
    period?: string;
  };
  icon: LucideIcon;
  iconColor?: string;
}

export function MetricCard({ title, value, change, icon: Icon, iconColor = "text-blue-600 dark:text-blue-400" }: MetricCardProps) {
  const getChangeColor = (type: string) => {
    switch (type) {
      case "increase":
        return "text-green-600 dark:text-green-400";
      case "decrease":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case "increase":
        return "↗";
      case "decrease":
        return "↘";
      default:
        return "";
    }
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
              {title}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-1 truncate">
              {value}
            </p>
            {change && (
              <p className={`text-xs sm:text-sm mt-1 ${getChangeColor(change.type)} truncate`}>
                <span className="mr-1">{getChangeIcon(change.type)}</span>
                {change.value}
                {change.period && (
                  <span className="text-gray-500 ml-1 hidden sm:inline">{change.period}</span>
                )}
              </p>
            )}
          </div>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0 ml-3`}>
            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
