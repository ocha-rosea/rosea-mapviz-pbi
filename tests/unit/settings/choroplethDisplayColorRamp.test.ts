import { describe, it, expect, beforeEach } from '@jest/globals';
// @ts-ignore internal import
import { RoseaMapVizFormattingSettingsModel } from '../../../src/settings';
import { ClassificationMethods } from '../../../src/constants/strings';

describe('choroplethClassificationSettingsGroup.applyConditionalDisplayRules (color ramp)', () => {
  let group: any;
  beforeEach(() => {
    const model = new RoseaMapVizFormattingSettingsModel();
    group = model.ChoroplethVisualCardSettings.choroplethClassificationSettingsGroup;
  });

  it('hides customColorRamp when colorRamp != custom', () => {
    group.classificationMethod.value = { value: ClassificationMethods.Quantile, displayName: 'Quantile' };
    group.colorRamp.value = { value: 'viridis', displayName: 'Viridis' };
    group.applyConditionalDisplayRules();
    expect(group.customColorRamp.visible).toBe(false);
  });

  it('shows customColorRamp when colorRamp == custom and not unique classification', () => {
    group.classificationMethod.value = { value: ClassificationMethods.Quantile, displayName: 'Quantile' };
    group.colorRamp.value = { value: 'custom', displayName: 'Custom' };
    group.applyConditionalDisplayRules();
    expect(group.customColorRamp.visible).toBe(true);
  });

  it('hides colorRamp settings when unique classification is selected', () => {
    group.classificationMethod.value = { value: ClassificationMethods.Unique, displayName: 'Categorical/Ordinal' };
    group.applyConditionalDisplayRules();
    expect(group.colorRamp.visible).toBe(false);
    expect(group.customColorRamp.visible).toBe(false);
    expect(group.invertColorRamp.visible).toBe(false);
    expect(group.colorMode.visible).toBe(false);
  });
});
