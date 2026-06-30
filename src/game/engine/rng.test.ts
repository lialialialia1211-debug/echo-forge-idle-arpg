import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("seeded rng", () => {
  it("repeats the same sequence for the same seed", () => {
    const first = createRng("echo-seed");
    const second = createRng("echo-seed");

    expect([first.next(), first.next(), first.int(1, 10)]).toEqual([
      second.next(),
      second.next(),
      second.int(1, 10),
    ]);
  });
});
