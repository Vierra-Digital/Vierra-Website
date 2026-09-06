import { afterEach, describe, expect, it, vi } from "vitest";
import { deletePanelFile, loadPanelFiles } from "@/lib/panel/files";

afterEach(() => vi.unstubAllGlobals());

describe("panel file loading", () => {
  it("distinguishes a successfully empty workspace from failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(loadPanelFiles()).resolves.toEqual([]);
  });

  it.each([
    ["server error", () => new Response("unavailable", { status: 503 })],
    ["expired session returning HTML", () => new Response("<html>Sign in</html>")],
    ["unexpected payload", () => Response.json({ message: "No session" })],
    ["malformed rows", () => Response.json([{ name: "missing identifiers.pdf" }])],
  ])("does not render %s as an empty list", async (_name, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    await expect(loadPanelFiles()).rejects.toThrow("Could not load files");
  });

  it("keeps client scope encoded and preserves protected-file metadata", async () => {
    const files = [{ id: "f1", name: "Agreement.pdf", date: "09/05/2026", fileType: "PDF", isDeletionProtected: true }];
    const fetchMock = vi.fn().mockResolvedValue(Response.json(files));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadPanelFiles("client&filter=me")).resolves.toEqual(files);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/files?filter=client%26filter%3Dme");
  });

  it("allows a fresh attempt after network failure", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(Response.json([])));
    await expect(loadPanelFiles()).rejects.toThrow("Could not load files");
    await expect(loadPanelFiles()).resolves.toEqual([]);
  });
});

describe("panel file deletion", () => {
  it("reports success only after the server accepts deletion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deletePanelFile("file&id=other")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/deleteFile?id=file%26id%3Dother", { method: "DELETE" });
  });

  it("explains a protected file or lost permission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(deletePanelFile("f1")).rejects.toThrow("protected or you no longer have permission");
  });

  it("does not mistake a sign-in page for confirmed deletion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Sign in</html>")));
    await expect(deletePanelFile("f1")).rejects.toThrow("Could not confirm deletion");
  });

  it("reconciles an already deleted file through refresh", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(deletePanelFile("f1")).rejects.toThrow("refresh the list");
  });

  it.each(["network", "server"])("does not automatically retry an uncertain %s result", async (failure) => {
    const fetchMock = failure === "network"
      ? vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      : vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deletePanelFile("f1")).rejects.toThrow("Could not confirm deletion");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
