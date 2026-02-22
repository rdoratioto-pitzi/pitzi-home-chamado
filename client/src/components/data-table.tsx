import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  onCheckboxChange?: (rowId: string, checked: boolean) => void;
  showCheckbox?: boolean;
  checkboxChecked?: (row: any) => boolean;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable({ 
  columns, 
  data, 
  onRowClick, 
  onCheckboxChange,
  showCheckbox = false,
  checkboxChecked,
  isLoading = false,
  emptyMessage = "Nenhum resultado encontrado."
}: DataTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {showCheckbox && <TableHead className="w-12"></TableHead>}
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell 
                colSpan={columns.length + (showCheckbox ? 1 : 0)} 
                className="h-24 text-center"
              >
                Carregando...
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            {showCheckbox && (
              <TableHead className="w-12 text-center">
                <span className="sr-only">Concluir</span>
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead key={column.key} className={cn("font-semibold", column.className)}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length + (showCheckbox ? 1 : 0)} 
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow 
                key={row.id}
                className={cn(
                  "cursor-pointer transition-colors",
                  onRowClick && "hover:bg-muted/50"
                )}
                onClick={() => onRowClick?.(row)}
              >
                {showCheckbox && (
                  <TableCell 
                    onClick={(e) => e.stopPropagation()}
                    className="text-center"
                  >
                    <Checkbox
                      checked={checkboxChecked ? checkboxChecked(row) : row.status === 'done'}
                      onCheckedChange={(checked) => 
                        onCheckboxChange?.(row.id, checked as boolean)
                      }
                      className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                    />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell 
                    key={column.key}
                    className={column.className}
                  >
                    {column.render 
                      ? column.render(row[column.key], row)
                      : row[column.key] || '-'
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
