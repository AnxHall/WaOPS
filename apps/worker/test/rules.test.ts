import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CPU_RULE,
  evaluateThresholdRule,
  RuleStateTracker,
} from '../src/rules.engine.js';

describe('evaluateThresholdRule', () => {
  it('does not fire on a single isolated sample (EVENT_CATALOG rule)', () => {
    const r = evaluateThresholdRule(DEFAULT_CPU_RULE, 0, 99);
    expect(r.fired).toBe(false);
    expect(r.consecutiveCount).toBe(1);
  });

  it('fires after 6 consecutive violating samples', () => {
    let count = 0;
    let fired = false;
    for (let i = 0; i < 6; i++) {
      const r = evaluateThresholdRule(DEFAULT_CPU_RULE, count, 95);
      count = r.consecutiveCount;
      fired = r.fired;
    }
    expect(count).toBe(6);
    expect(fired).toBe(true);
  });

  it('resets consecutive count on healthy sample', () => {
    const high = evaluateThresholdRule(DEFAULT_CPU_RULE, 5, 95);
    expect(high.consecutiveCount).toBe(6);
    const recovered = evaluateThresholdRule(DEFAULT_CPU_RULE, high.consecutiveCount, 40);
    expect(recovered.fired).toBe(false);
    expect(recovered.consecutiveCount).toBe(0);
  });

  it('does not fire below threshold', () => {
    const r = evaluateThresholdRule(DEFAULT_CPU_RULE, 0, 89.9);
    expect(r.fired).toBe(false);
    expect(r.consecutiveCount).toBe(0);
  });
});

describe('RuleStateTracker', () => {
  it('tracks per rule+resource independently', () => {
    const tracker = new RuleStateTracker();
    for (let i = 0; i < 5; i++) {
      tracker.track('cpu', 'host_a', 95, DEFAULT_CPU_RULE);
    }
    const fired = tracker.track('cpu', 'host_a', 96, DEFAULT_CPU_RULE);
    expect(fired.fired).toBe(true);

    const otherHost = tracker.track('cpu', 'host_b', 96, DEFAULT_CPU_RULE);
    expect(otherHost.fired).toBe(false);
  });

  it('reset clears state', () => {
    const tracker = new RuleStateTracker();
    for (let i = 0; i < 6; i++) tracker.track('cpu', 'h', 95, DEFAULT_CPU_RULE);
    tracker.reset('cpu', 'h');
    const r = tracker.track('cpu', 'h', 95, DEFAULT_CPU_RULE);
    expect(r.fired).toBe(false);
  });
});
