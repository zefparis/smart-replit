import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Column {
  key: string;
  header: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  actions?: {
    label: string;
    onClick: (row: any) => void;
    variant?: "default" | "destructive";
  }[];
  loading?: boolean;
}

export function DataTable({ data, columns, actions, loading }: DataTableProps) {
  if (loading) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 dark:bg-gray-700/50">
            {columns.map((column) => (
              <TableHead key={column.key} className="font-medium">
                {column.header}
              </TableHead>
            ))}
            {actions && actions.length > 0 && (
              <TableHead className="w-12"></TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(Array.isArray(data) ? data : []).map((row, index) => (
            <TableRow 
              key={index} 
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render 
                    ? column.render(row[column.key], row)
                    : row[column.key]
                  }
                </TableCell>
              ))}
              {actions && actions.length > 0 && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0"
                        data-testid={`actions-${index}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions.map((action, actionIndex) => (
                        <DropdownMenuItem
                          key={actionIndex}
                          onClick={() => action.onClick(row)}
                          className={action.variant === "destructive" ? "text-red-600" : ""}
                          data-testid={`action-${action.label.toLowerCase().replace(/\s+/g, '-')}-${index}`}
                        >
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper function to render status badges
export function StatusBadge({ status }: { status: string }) {
  const getVariant = (status: string) => {
    if (!status) return "secondary";
    switch (status.toLowerCase()) {
      case "active":
      case "completed":
      case "paid":
      case "running":
        return "default" as const;
      case "pending":
      case "training":
        return "secondary" as const;
      case "failed":
      case "error":
      case "overdue":
        return "destructive" as const;
      case "inactive":
      case "cancelled":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  return <Badge variant={getVariant(status)}>{status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}</Badge>;
}
