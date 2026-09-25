import type { EventSeverity } from '@waops/contracts';

/**
 * Threshold rule with duration window (EVENT_CATALOG.md: infra.cpu.high
 * "requires duration/hysteresis; never emit on one isolated sample").
 * Pure functions — unit-testable without infra.
 */
export interface ThresholdRule {
  metric: string;
  comparator: '>' | '<';
  threshold: number;
  /** How many consecutive violating samples before firing. */
  consecutiveSamples: number;
  severity: EventSeverity;
  eventType: string;
}

export interface RuleEvaluation {
  fired: boolean;
  eventType?: string;
  severity?: EventSeverity;
  value?: number;
  consecutiveCount: number;
}

/** Append a sample and evaluate the rule against the rolling window. */
export function evaluateThresholdRule(
  rule: ThresholdRule,
  priorConsecutiveCount: number,
  value: number,
): RuleEvaluation {
  const violates =
    rule.comparator === '>' ? value > rule.threshold : value < rule.threshold;
  const consecutiveCount = violates ? priorConsecutiveCount + 1 : 0;
  if (consecutiveCount >= rule.consecutiveSamples) {
    return {
      fired: true,
      eventType: rule.eventType,
      severity: rule.severity,
      value,
      consecutiveCount,
    };
  }
  return { fired: false, consecutiveCount, value };
}

/** Default alpha rule of the foundation: CPU > 90% for 6 consecutive samples (60s at 10s). */
export const DEFAULT_CPU_RULE: ThresholdRule = {
  metric: 'host.cpu.usage_percent',
  comparator: '>',
  threshold: 90,
  consecutiveSamples: 6,
  severity: 'high',
  eventType: 'infra.cpu.high',
};

/**
 * Per-resource consecutive-count tracker (in-memory; durable rule state is
 * part of the full rules engine in WaMonitor phase).
 */
export class RuleStateTracker {
  private readonly counts = new Map<string, number>();

  track(ruleId: string, resourceId: string, value: number, rule: ThresholdRule): RuleEvaluation {
    const key = `${ruleId}:${resourceId}`;
    const prior = this.counts.get(key) ?? 0;
    const result = evaluateThresholdRule(rule, prior, value);
    this.counts.set(key, result.consecutiveCount);
    return result;
  }

  reset(ruleId: string, resourceId: string): void {
    this.counts.delete(`${ruleId}:${resourceId}`);
  }
}
