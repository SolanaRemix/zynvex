import { can, type RoleName } from "@zynvex/security";
import { ApiError } from "./errors";

export function requirePermission(role: string, permission: string) {
  if (!can(role as RoleName, permission)) {
    throw new ApiError("FORBIDDEN", 403, `Missing permission: ${permission}`);
  }
}
