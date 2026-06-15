/**
 * `assertBranchName` is the only line of defence against a malicious branch
 * name reaching `git checkout`'s argv as an option flag. Treat the regex as
 * the contract under test — any change to it must keep these refusals.
 */

import { describe, expect, it } from "vitest"
import { assertBranchName, InvalidBranchNameError } from "../branch"

describe("assertBranchName", () => {
  it("accepts the common feature-branch shapes", () => {
    for (const name of [
      "feature",
      "fix/x",
      "feature/login-form",
      "release/v1_2",
      "user/foo/bar-baz",
      "x9",
      "ai-edits-2026-05-13",
    ]) {
      expect(() => assertBranchName(name), name).not.toThrow()
    }
  })

  it("refuses names that would parse as a flag (`--foo`)", () => {
    for (const evil of ["--upload-pack=evil", "-x", "--help"]) {
      expect(() => assertBranchName(evil)).toThrow(InvalidBranchNameError)
    }
  })

  it("refuses uppercase, spaces, dots, tildes, semicolons, backticks", () => {
    for (const evil of ["Main", "feature x", "release.v1", "feature~1", "main;rm-rf", "main`evil`"]) {
      expect(() => assertBranchName(evil)).toThrow(InvalidBranchNameError)
    }
  })

  it("refuses overlong names (>80 chars)", () => {
    expect(() => assertBranchName("a".repeat(81))).toThrow(InvalidBranchNameError)
    expect(() => assertBranchName("a".repeat(80))).not.toThrow()
  })

  it("refuses non-string input", () => {
    expect(() => assertBranchName(undefined as unknown as string)).toThrow(InvalidBranchNameError)
    expect(() => assertBranchName(42 as unknown as string)).toThrow(InvalidBranchNameError)
  })
})
