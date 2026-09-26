import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RateLimitSparkline } from '../src/components/RateLimitSparkline';

/**
 * Sparkline 429/min (HM05 follow-up): uma barra por bucket de 60s, tooltip
 * nativo com timestamp, cor de alerta (`--status-warning`) apenas em buckets
 * com 429s e stub de 1px para buckets zerados (continuidade da série).
 */

afterEach(cleanup);

const MIN = 60_000;
const bucket = (m: number) => new Date((1_700_000_000 + m) * MIN).toISOString();

describe('RateLimitSparkline', () => {
  it('renders one bar + native tooltip per bucket (15-minute window)', () => {
    const points = Array.from({ length: 15 }, (_, i) => ({
      windowStart: bucket(i),
      limited: i,
    }));
    const { container } = render(<RateLimitSparkline points={points} />);
    const bars = container.querySelectorAll('svg rect');
    expect(bars.length).toBe(15);
    const titles = container.querySelectorAll('svg rect title');
    expect(titles.length).toBe(15);
    expect(titles[0]?.textContent).toContain('0 limitado(s)');
    expect(titles[14]?.textContent).toContain('14 limitado(s)');
    // ordem cronológica → barra mais alta no fim (max = 14)
    expect(Number(bars[14]?.getAttribute('height'))).toBeGreaterThan(Number(bars[0]?.getAttribute('height') ?? 0));
  });

  it('colors alert bars only for buckets with 429s; zero buckets stay visible', () => {
    const { container } = render(
      <RateLimitSparkline
        points={[
          { windowStart: bucket(0), limited: 0 },
          { windowStart: bucket(1), limited: 7 },
          { windowStart: bucket(2), limited: 0 },
        ]}
      />,
    );
    const bars = [...container.querySelectorAll('svg rect')];
    expect(bars.length).toBe(3);
    // zero-bucket: stub de 1px visível, cor neutra
    expect(Number(bars[0]?.getAttribute('height'))).toBe(1);
    expect(bars[0]?.getAttribute('fill')).toContain('border-default');
    // bucket com 429: barra proporcional, cor de alerta
    expect(Number(bars[1]?.getAttribute('height'))).toBeGreaterThan(1);
    expect(bars[1]?.getAttribute('fill')).toContain('status-warning');
    expect(Number(bars[2]?.getAttribute('height'))).toBe(1);
  });
});
