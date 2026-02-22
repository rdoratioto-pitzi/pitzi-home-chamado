import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Table } from "lucide-react";

interface ExportButtonProps {
  data: any[];
  filename: string;
  columns: { key: string; label: string }[];
}

export function ExportButton({ data, filename, columns }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    setIsExporting(true);
    try {
      const header = columns.map(c => c.label).join(",");
      const rows = data.map(item => 
        columns.map(col => {
          const value = item[col.key];
          const strValue = String(value ?? "").replace(/"/g, '""');
          return strValue.includes(",") ? `"${strValue}"` : strValue;
        }).join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      // Criar HTML table para Excel
      let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1">';
      
      // Header
      html += '<tr>';
      columns.forEach(col => {
        html += `<th style="background-color:#4472C4;color:white;font-weight:bold;padding:8px;">${col.label}</th>`;
      });
      html += '</tr>';
      
      // Rows
      data.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f2f2f2';
        html += `<tr style="background-color:${bgColor}">`;
        columns.forEach(col => {
          const value = item[col.key] ?? "";
          html += `<td style="padding:6px;">${value}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</table></body></html>';
      
      const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToJSON = () => {
    setIsExporting(true);
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting || data.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToExcel}>
          <Table className="h-4 w-4 mr-2" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToJSON}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
