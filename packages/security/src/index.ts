export const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: ["*"],
  ADMIN: [
    "organization.read",
    "organization.update",
    "users.manage",
    "projects.create",
    "projects.read",
    "projects.update",
    "projects.delete",
    "agents.create",
    "agents.execute",
    "agents.manage",
    "workflows.create",
    "workflows.execute",
    "knowledge.manage",
    "billing.manage",
    "api_keys.manage",
    "wallet.connect",
    "treasury.view",
    "treasury.manage",
    "audit.read"
  ],
  MEMBER: ["projects.create", "projects.read", "agents.execute", "workflows.execute"],
  DEVELOPER: ["projects.read", "projects.update", "agents.create", "agents.execute", "workflows.create", "workflows.execute", "api_keys.manage"],
  VIEWER: ["organization.read", "projects.read"]
};

export type RoleName = keyof typeof ROLE_PERMISSIONS;

export function can(role: RoleName, permission: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] ?? [];
  return allowed.includes("*") || allowed.includes(permission);
}
