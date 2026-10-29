// CSV Export utility

export function exportToCSV(filename, rows, headers) {
  if (!rows || !rows.length) return;

  const headerKeys = Object.keys(headers);
  const headerLabels = Object.values(headers);

  const csvRows = [
    headerLabels.map((label) => `"${label.replace(/"/g, '""')}"`).join(','),
  ];

  for (const row of rows) {
    const values = headerKeys.map((key) => {
      const val = row[key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvBlob = new Blob([csvRows.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
