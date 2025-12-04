import { describe, it, expect } from '@jest/globals';
import { RoseaMapVizFormattingSettingsModel } from '../../../src/settings';
import { OptionsService } from '../../../src/services/OptionsService';

function makeModel() { return new RoseaMapVizFormattingSettingsModel(); }

describe('OptionsService edge cases', () => {
  it('passes through classes value from settings', () => {
    const model = makeModel();
    const grp: any = model.ChoroplethVisualCardSettings.choroplethClassificationSettingsGroup;
    // Set a positive value
    grp.numClasses.value = 5;
    const opts = OptionsService.getChoroplethOptions(model);
    expect(opts.classes).toBe(5);
  });

  it('handles missing customColorRamp gracefully', () => {
    const model = makeModel();
    const grp: any = model.ChoroplethVisualCardSettings.choroplethClassificationSettingsGroup;
    grp.colorRamp.value = { value: 'custom', displayName: 'Custom' };
    grp.customColorRamp.value = '   '; // blank
    const opts = OptionsService.getChoroplethOptions(model);
    expect(opts.customColorRamp.trim()).toBe('');
  });
});
