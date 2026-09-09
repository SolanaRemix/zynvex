import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const { id } = await context.params;

    const evaluation = await prisma.evaluation.findFirst({
      where: { id, organizationId: session.organizationId }
    });
    if (!evaluation) {
      return Response.json({ code: "NOT_FOUND", message: "Evaluation not found", requestId: ctx.requestId, details: null }, { status: 404 });
    }

    const cases = Array.isArray(evaluation.cases) ? evaluation.cases as Array<{ key?: string; input?: string; expectedContains?: string[] }> : [];
    const run = await prisma.evaluationRun.create({
      data: {
        organizationId: session.organizationId,
        evaluationId: evaluation.id,
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date()
      }
    });

    let passed = 0;
    for (const testCase of cases) {
      const expected = Array.isArray(testCase.expectedContains) ? testCase.expectedContains.map(String) : [];
      const inputText = String(testCase.input ?? "");
      const output = inputText;
      const success = expected.every((value) => output.toLowerCase().includes(value.toLowerCase()));
      if (success) passed += 1;

      await prisma.evaluationResult.create({
        data: {
          organizationId: session.organizationId,
          evaluationRunId: run.id,
          caseKey: String(testCase.key ?? globalThis.crypto.randomUUID()),
          status: success ? "PASS" : "FAIL",
          input: { text: inputText },
          output: { text: output },
          metrics: { expectedChecks: expected.length, passedChecks: success ? expected.length : 0 }
        }
      });
    }

    const updatedRun = await prisma.evaluationRun.update({
      where: { id: run.id },
      data: {
        summary: {
          totalCases: cases.length,
          passed,
          failed: cases.length - passed,
          passRate: cases.length ? passed / cases.length : 0
        }
      }
    });

    return Response.json({ run: updatedRun }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
