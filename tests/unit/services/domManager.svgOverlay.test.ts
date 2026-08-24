import { describe, expect, it } from '@jest/globals';
import { DOMManager } from '../../../src/services/DOMManager';
import { DomIds } from '../../../src/constants/strings';

describe('DOMManager SVG overlay', () => {
    const build = () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        return new DOMManager({ container });
    };

    it('creates a dedicated overlay rather than adopting the export button icon', () => {
        const elements = build().getElements();

        expect(elements.svgOverlay.id).toBe(DomIds.SvgOverlay);
        expect(elements.svgOverlay.getAttribute('viewBox')).toBeNull();
        expect(elements.svgOverlay.style.position).toBe('absolute');
        expect(elements.svgOverlay.style.width).toBe('100%');
        expect(elements.svgOverlay.parentElement).toBe(elements.svgContainer);
    });

    it('leaves the export button icon intact', () => {
        const elements = build().getElements();

        const icon = elements.exportButton.querySelector('svg');
        expect(icon).not.toBeNull();
        expect(icon).not.toBe(elements.svgOverlay);
        expect(icon?.querySelectorAll('path').length).toBe(2);
    });

    it('clearSvg does not strip the export button icon', () => {
        const domManager = build();
        const elements = domManager.getElements();

        domManager.clearSvg();

        expect(elements.exportButton.querySelectorAll('path').length).toBe(2);
    });
});
