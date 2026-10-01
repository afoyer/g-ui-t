import { describe, expect, it } from "vitest";
import { findAllOverlaps, findOverlaps } from "@/lib/overlap";

const maya = { id: "1", author_id: "maya", title: "Checkout redesign", changed_files: ["components/CartSummary.tsx", "components/PaymentForm.tsx"] };
const theo = { id: "2", author_id: "theo", title: "Saved trips list", changed_files: ["components/TripList.tsx", "components/CartSummary.tsx"] };
const ines = { id: "3", author_id: "ines", title: "Empty states", changed_files: ["components/EmptyState.tsx"] };
const mayaOther = { id: "4", author_id: "maya", title: "Promo", changed_files: ["components/CartSummary.tsx"] };

describe("findOverlaps", () => {
  it("finds other people's Changes touching the same files", () => {
    const result = findOverlaps(maya, [maya, theo, ines, mayaOther]);
    expect(result).toHaveLength(1);
    expect(result[0].change.title).toBe("Saved trips list");
    expect(result[0].components).toEqual(["CartSummary"]);
  });

  it("returns nothing when there's no shared file", () => {
    expect(findOverlaps(ines, [maya, theo])).toEqual([]);
  });
});

describe("findAllOverlaps", () => {
  it("lists each overlapping pair once", () => {
    const pairs = findAllOverlaps([maya, theo, ines, mayaOther]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([["1", "2"], ["2", "4"]]);
  });
});
