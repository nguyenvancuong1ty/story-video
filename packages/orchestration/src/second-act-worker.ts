export type QueueRow = Record<string, string> & { __rowNumber: string };

export const rowFromValues = (headers: string[], values: string[], rowNumber: number): QueueRow => {
  const row = { __rowNumber: String(rowNumber) } as QueueRow;
  for (const [index, header] of headers.entries()) {
    if (header) row[header] = values[index] ?? "";
  }
  return row;
};

export const findReadyJob = (rows: QueueRow[]): QueueRow | undefined =>
  rows.find((row) => row.Status?.trim().toUpperCase() === "READY_TO_RENDER");

export const requireWorkerFields = (row: QueueRow): { id: string; topic: string; rowNumber: number } => {
  const id = row.ID?.trim();
  const topic = row.Topic?.trim();
  const rowNumber = Number(row.__rowNumber);
  if (!id) throw new Error("Queue row is missing ID");
  if (!topic) throw new Error(`Queue row ${id} is missing Topic`);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error(`Queue row ${id} has invalid row number`);
  return { id, topic, rowNumber };
};

export const columnLetter = (index: number): string => {
  if (!Number.isInteger(index) || index < 0) throw new Error("Column index must be >= 0");
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};
