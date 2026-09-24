import { describe, expect, it } from 'vitest';
import { ModuleRegistry, MODULES_V1 } from '../src/index.js';

describe('ModuleRegistry', () => {
  it('loads modules from contracts mirror', () => {
    const reg = new ModuleRegistry();
    expect(reg.list()).toHaveLength(9);
    expect(reg.require('wamonitor').features).toContain('host_monitoring');
  });

  it('hasFeature checks feature membership', () => {
    const reg = new ModuleRegistry();
    expect(reg.hasFeature('wamonitor', 'docker_monitoring')).toBe(true);
    expect(reg.hasFeature('wamonitor', 'unknown_feature')).toBe(false);
    expect(reg.hasFeature('nomodule', 'x')).toBe(false);
  });

  it('require throws for unknown module', () => {
    const reg = new ModuleRegistry();
    expect(() => reg.require('nope')).toThrow(/unknown module/);
  });

  it('contracts list matches 9 modules of modules.v1.yaml', () => {
    const keys = MODULES_V1.map((m) => m.key);
    expect(keys).toEqual([
      'wamonitor',
      'wasupport',
      'wantry',
      'wadatabase',
      'wabackup',
      'waknowledge',
      'wanotify',
      'warelease',
      'waai',
    ]);
  });
});
