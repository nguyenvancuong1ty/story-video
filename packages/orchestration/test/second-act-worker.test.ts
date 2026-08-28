import { describe, expect, it } from "vitest";

import { columnLetter, findReadyJob, requireWorkerFields, rowFromValues } from "../src/second-act-worker.js";

describe("second-act worker queue helpers", () => {
  it("maps rows by header and finds READY_TO_RENDER", () => {
    const headers = ["ID", "Topic", "Status"];
    const rows = [
      rowFromValues(headers, ["SA-001", "one", "READY_FOR_SCRIPT"], 2),
      rowFromValues(headers, ["SA-002", "two", "READY_TO_RENDER"], 3)
    ];
    expect(findReadyJob(rows)?.ID).toBe("SA-002");
    expect(requireWorkerFields(rows[1])).toEqual({ id: "SA-002", topic: "two", rowNumber: 3 });
  });

  it("converts zero-based column indexes to A1 letters", () => {
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(19)).toBe("T");
    expect(columnLetter(25)).toBe("Z");
    expect(columnLetter(26)).toBe("AA");
  });
});
