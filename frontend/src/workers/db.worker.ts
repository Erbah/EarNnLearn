self.onmessage = (e: MessageEvent) => {
  const { data, columns } = e.data;
  if (!data || !columns) {
    self.postMessage({ error: 'Missing parameters' });
    return;
  }

  try {
    // Pre-format and stringify all cell values in the worker thread
    const formattedData = data.map((row: any) => {
      const formattedRow: Record<string, string> = {};
      columns.forEach((col: string) => {
        const val = row[col];
        if (val === null || val === undefined) {
          formattedRow[col] = 'NULL';
        } else if (typeof val === 'object') {
          formattedRow[col] = JSON.stringify(val);
        } else {
          formattedRow[col] = String(val);
        }
      });
      return formattedRow;
    });

    self.postMessage({ formattedData });
  } catch (err: any) {
    self.postMessage({ error: err.message || 'Error processing database rows' });
  }
};
