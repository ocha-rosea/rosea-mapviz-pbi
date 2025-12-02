import { describe, it, expect } from '@jest/globals';
// @ts-ignore
import { CircleSvgLayer } from '../../../src/layers/svg/circleSvgLayer';
// @ts-ignore
import { transformExtent } from 'ol/proj';

function bare(){ return Object.create(CircleSvgLayer.prototype);} 

describe('CircleSvgLayer.calculateCirclesExtent', () => {
  it('zero extent empty', () => { const l=bare(); const e=(l as any).calculateCirclesExtent([],[]); expect(e).toEqual(transformExtent([0,0,0,0],'EPSG:4326','EPSG:3857')); });
  it('valid extent', () => { const l=bare(); const e=(l as any).calculateCirclesExtent([10,12],[5,7]); expect(e[0]).toBeLessThan(e[2]); });
});