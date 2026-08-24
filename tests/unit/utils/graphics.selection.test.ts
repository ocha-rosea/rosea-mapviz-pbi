import { describe, expect, it } from '@jest/globals';
import { claimSharedOverlay, isSelectionIdSelected, selectionOpacity } from '../../../src/utils/graphics';

const makeSelectionId = (key: string) => ({
    key,
    equals(other: any) { return other?.key === key; }
});

describe('isSelectionIdSelected', () => {
    it('matches a distinct instance that represents the same selection', () => {
        const selected = [makeSelectionId('a')];
        expect(isSelectionIdSelected(selected, makeSelectionId('a'))).toBe(true);
    });

    it('does not match a different selection', () => {
        const selected = [makeSelectionId('a')];
        expect(isSelectionIdSelected(selected, makeSelectionId('b'))).toBe(false);
    });

    it('falls back to reference equality when equals() is unavailable', () => {
        const datum = { key: 'a' };
        expect(isSelectionIdSelected([datum], datum)).toBe(true);
        expect(isSelectionIdSelected([{ key: 'a' }], datum)).toBe(false);
    });

    it('returns false for empty selections or missing datum ids', () => {
        expect(isSelectionIdSelected([], makeSelectionId('a'))).toBe(false);
        expect(isSelectionIdSelected([makeSelectionId('a')], undefined)).toBe(false);
    });
});

describe('selectionOpacity', () => {
    it('keeps full opacity when nothing is selected', () => {
        expect(selectionOpacity([], makeSelectionId('a'), 0.8)).toBe(0.8);
    });

    it('keeps full opacity for a selection arriving as a separate instance', () => {
        expect(selectionOpacity([makeSelectionId('a')], makeSelectionId('a'), 0.8)).toBe(0.8);
    });

    it('dims data points that are not selected', () => {
        expect(selectionOpacity([makeSelectionId('a')], makeSelectionId('b'), 0.8)).toBe(0.4);
    });
});

describe('claimSharedOverlay', () => {
    it('returns the container to the first caller and null to later callers in the same frame', () => {
        const container = document.createElement('div');
        const frameState: any = { index: 1 };

        expect(claimSharedOverlay(frameState, container)).toBe(container);
        expect(claimSharedOverlay(frameState, container)).toBeNull();
    });

    it('lets the container be claimed again on the next frame', () => {
        const container = document.createElement('div');

        expect(claimSharedOverlay({ index: 1 } as any, container)).toBe(container);
        expect(claimSharedOverlay({ index: 2 } as any, container)).toBe(container);
    });
});
