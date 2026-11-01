"use client";
import { PlacementBoard } from "@/components/board/placement-board";
import { PermissionGate } from "@/components/permission-gate";

export default function BoardPage() {
  return (
    <PermissionGate perm="board">
      <PlacementBoard />
    </PermissionGate>
  );
}
