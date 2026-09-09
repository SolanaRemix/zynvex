import { getTokenIntegrationState } from "@zynvex/blockchain";

export async function GET() {
  const state = getTokenIntegrationState(process.env);
  return Response.json(state);
}
