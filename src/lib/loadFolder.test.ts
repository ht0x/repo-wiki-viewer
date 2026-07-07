import { describe, it, expect } from "vitest";
import { loadFromInput } from "./loadFolder";

function mkFile(relPath: string, content: string): File {
  const name = relPath.split("/").pop() ?? relPath;
  return {
    name,
    webkitRelativePath: relPath,
    text: async () => content,
  } as unknown as File;
}

function mkFileList(files: File[]): FileList {
  return files as unknown as FileList;
}

describe("loadFromInput — file filtering", () => {
  it("keeps text/markdown/yaml/json files and drops others", async () => {
    const map = await loadFromInput(
      mkFileList([
        mkFile("repo/home.md", "# Home"),
        mkFile("repo/plan.yaml", "title: x"),
        mkFile("repo/data.json", "{}"),
        mkFile("repo/notes.txt", "hi"),
        mkFile("repo/logo.png", "binary"),
        mkFile("repo/script.js", "code"),
      ]),
    );
    const keys = [...map.keys()].sort();
    expect(keys).toEqual(["data.json", "home.md", "notes.txt", "plan.yaml"]);
  });

  it("excludes files inside ignored dirs (node_modules, .git)", async () => {
    const map = await loadFromInput(
      mkFileList([
        mkFile("repo/home.md", "# Home"),
        mkFile("repo/node_modules/dep/readme.md", "dep"),
        mkFile("repo/.git/config.txt", "gitcfg"),
      ]),
    );
    expect([...map.keys()]).toEqual(["home.md"]);
  });
});

describe("loadFromInput — root stripping", () => {
  it("strips a single common root dir", async () => {
    const map = await loadFromInput(
      mkFileList([
        mkFile("wiki/home.md", "# Home"),
        mkFile("wiki/modules/inventory.md", "# Inv"),
      ]),
    );
    expect([...map.keys()].sort()).toEqual(["home.md", "modules/inventory.md"]);
  });

  it("does not strip when roots differ", async () => {
    const map = await loadFromInput(
      mkFileList([mkFile("a/home.md", "# A"), mkFile("b/home.md", "# B")]),
    );
    expect([...map.keys()].sort()).toEqual(["a/home.md", "b/home.md"]);
  });

  it("maps file content correctly", async () => {
    const map = await loadFromInput(
      mkFileList([mkFile("wiki/home.md", "# Hello")]),
    );
    expect(map.get("home.md")).toBe("# Hello");
  });
});
