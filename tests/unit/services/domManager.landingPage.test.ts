import { describe, expect, it } from '@jest/globals';
import { DOMManager } from '../../../src/services/DOMManager';

/** Stands in for LocalizationService with obviously non-English values. */
const localizationStub = {
    get: (key: string) => `L(${key})`,
    getLandingTitle: () => 'TITLE',
    getLandingDescription: () => 'DESCRIPTION',
    getLandingGettingStarted: () => 'GETTING_STARTED',
    getLandingChoroplethMap: () => 'CHOROPLETH_LABEL',
    getLandingChoroplethInstructions: () => 'CHOROPLETH_SENTENCE',
    getLandingScaledCircles: () => 'CIRCLES_LABEL',
    getLandingScaledCirclesInstructions: () => 'CIRCLES_SENTENCE',
    getLandingTip: () => 'TIP'
} as any;

const build = (localized: boolean) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const domManager = new DOMManager({ container });
    if (localized) domManager.setLocalizationService(localizationStub);
    domManager.showLandingPage();
    return { container, domManager };
};

describe('DOMManager landing page', () => {
    it('renders the localized instruction sentences rather than hardcoded English', () => {
        const { container } = build(true);
        const hints = Array.from(container.querySelectorAll('.landing-hint')).map(n => n.textContent);

        expect(hints).toEqual(['CHOROPLETH_SENTENCE', 'CIRCLES_SENTENCE']);
        expect(container.textContent).not.toContain('Add ');
        expect(container.textContent).not.toContain(' fields');
    });

    it('renders the localized tip rather than the hardcoded English one', () => {
        const { container } = build(true);

        expect(container.querySelector('.landing-tip')?.textContent).toBe('TIP');
    });

    it('renders each data role as a field chip', () => {
        const { container } = build(true);
        const chips = Array.from(container.querySelectorAll('.landing-fields em')).map(n => n.textContent);

        expect(chips).toEqual([
            'L(Role_BoundaryID)',
            'L(Role_ChoroplethColor)',
            'L(Role_Longitude)',
            'L(Role_Latitude)',
            'L(Role_CircleSize)'
        ]);
    });

    it('falls back to English when no localization service is set', () => {
        const { container } = build(false);

        expect(container.querySelector('h2')?.textContent).toBe('ROSEA MapViz');
        expect(container.querySelector('.landing-hint')?.textContent)
            .toBe('Add Boundary ID and Choropleth Color fields');
    });

    it('renders the logo as inline SVG that scales from CSS', () => {
        const { container } = build(false);
        const logo = container.querySelector('.landing-icon svg');

        expect(logo).not.toBeNull();
        expect(logo?.querySelectorAll('path').length).toBeGreaterThan(0);
        // Sizing belongs to the stylesheet so the page can scale with the visual.
        expect(logo?.getAttribute('width')).toBeNull();
        expect(logo?.getAttribute('height')).toBeNull();
    });

    it('shows only once and can be hidden again', () => {
        const { container, domManager } = build(false);
        domManager.showLandingPage();
        expect(container.querySelectorAll('.rosea-landing-page').length).toBe(1);

        domManager.hideLandingPage();
        expect(container.querySelector('.rosea-landing-page')).toBeNull();
        expect(domManager.isLandingPageShown()).toBe(false);
    });
});
