import * as XLSX from "xlsx";

export class ExportUtils {
  /**
   * Exporta dados para Excel
   * @param data Array de objetos para exportar
   * @param filename Nome do arquivo
   * @param sheetName Nome da aba da planilha
   */
  static exportToExcel(
    data: any[],
    filename: string,
    sheetName: string = "Dados"
  ) {
    if (!data || data.length === 0) {
      console.warn("No data to export");
      return;
    }

    // Criar workbook
    const ws = XLSX.utils.json_to_sheet(data);

    // Estilos e formatação
    const headerCells = Object.keys(data[0]);
    const wscols = headerCells.map((header) => ({
      wch: Math.max(
        header.length,
        Math.max(
          ...data.map((row) => {
            const value = row[header];
            return String(value).length;
          })
        )
      ),
    }));

    ws["!cols"] = wscols;

    // Aplicar estilos aos headers
    for (let i = 0; i < headerCells.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    }

    // Criar workbook e adicionar a aba
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Fazer download
    XLSX.writeFile(wb, filename);
  }

  /**
   * Exporta múltiplas abas
   * @param sheets Array de { name, data }
   * @param filename Nome do arquivo
   */
  static exportToExcelMultiSheet(
    sheets: Array<{ name: string; data: any[] }>,
    filename: string
  ) {
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ name, data }) => {
      if (data && data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
      }
    });

    XLSX.writeFile(wb, filename);
  }
}
