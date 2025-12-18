import { describe, it, expect, beforeEach } from '@jest/globals';
// @ts-ignore internal import
import { RoseaMapVizFormattingSettingsModel } from '../../../src/settings';

describe('mapToolsVisualCardSettings.applyConditionalDisplayRules', () => {
  let card: any;
  beforeEach(() => {
    const model = new RoseaMapVizFormattingSettingsModel();
    card = model.mapToolsVisualCardSettings;
  });

  it('hides locked extent & zoom storage fields', () => {
    card.lockMapExtent.value = false;
    card.applyConditionalDisplayRules();
    expect(card.lockedMapExtent.visible).toBe(false);
    expect(card.lockedMapZoom.visible).toBe(false);
  });

  it('keeps zoom control toggle visible when lock extent is enabled', () => {
    card.lockMapExtent.value = true;
    card.showZoomControl.value = true;
    card.applyConditionalDisplayRules();
    // Zoom control toggle should remain visible (not hidden when locked)
    expect(card.showZoomControl.visible).not.toBe(false);
    // User's choice should be preserved
    expect(card.showZoomControl.value).toBe(true);
  });
});
