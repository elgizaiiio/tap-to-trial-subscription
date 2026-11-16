import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { approve, read } = vi.hoisted(() => ({ approve: vi.fn(), read: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/ceyo/integrations.functions", () => ({ integrationApproval: approve, integrationApprovalStatus: read }));
import { IntegrationApprovalCard } from "./IntegrationApprovalCard";
beforeEach(() => { vi.clearAllMocks(); read.mockResolvedValue({ status: "pending" }); approve.mockResolvedValue({ status: "completed" }); });
it("continues only after the action is confirmed completed", async () => {
  const onApproved = vi.fn();
  render(<IntegrationApprovalCard data={{ id: "approval", app: "github", action: "GITHUB_DOWNLOAD_ARCHIVE" }} onDone={vi.fn()} onApproved={onApproved} />);
  fireEvent.click(screen.getByRole("button", { name: "Allow", exact: true }));
  await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
  expect(approve).toHaveBeenCalledWith({ data: { id: "approval", approved: true, always: false } });
});
it("does not continue a rejected action", async () => {
  approve.mockResolvedValue({ status: "rejected" });
  const onApproved = vi.fn(), onDone = vi.fn();
  render(<IntegrationApprovalCard data={{ id: "approval", app: "github" }} onDone={onDone} onApproved={onApproved} />);
  fireEvent.click(screen.getByRole("button", { name: "Decline" }));
  await waitFor(() => expect(onDone).toHaveBeenCalled());
  expect(onApproved).not.toHaveBeenCalled();
});