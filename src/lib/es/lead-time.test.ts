import { describe, expect, it } from "vitest";
import { leadTimeLabel } from "./lead-time";

describe("leadTimeLabel", () => {
  it("hides unset and zero lead times", () => {
    expect(leadTimeLabel(undefined)).toBeNull();
    expect(leadTimeLabel([0, 0])).toBeNull();
  });
  it("formats ranges and single values", () => {
    expect(leadTimeLabel([2, 4])).toBe("2–4 weeks");
    expect(leadTimeLabel([1, 1])).toBe("1 week");
    expect(leadTimeLabel([0, 3])).toBe("Up to 3 weeks");
    expect(leadTimeLabel([2, 4], "wks")).toBe("2–4 wks");
  });
});
