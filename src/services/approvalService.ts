export interface PlanStep {
  action: string;
  type?: string;
  details?: any;
}

export interface Plan {
  steps: PlanStep[];
  estimatedTokens?: string;
}

export const checkApprovalRequired = (plan: Plan) => {
  const highCostKeywords = ['research_extensive', 'bulk_update', 'loop_retry_3'];
  const criticalActions = ['gmail_send', 'calendar_delete', 'drive_trash', 'create_keep_note']; // Added keep for demo

  const needsApproval = plan.steps.some((step: PlanStep) => 
    criticalActions.includes(step.action) || (step.type && highCostKeywords.includes(step.type))
  );

  if (needsApproval) {
    return {
      status: "PENDING_USER",
      message: "Tarefa de alto custo ou crítica detectada. Aguardando aprovação via App.",
      costEstimate: plan.estimatedTokens || "Calculando..."
    };
  }
  return { status: "PROCEED" };
};
