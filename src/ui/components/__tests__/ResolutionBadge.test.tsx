import {describe,it,expect} from 'vitest';
import {resolutionUses} from '../ResolutionBadge';
describe('Resolution reference sizes',()=>{
 it('separates thumbnails, phones, HD and 4K without promising optical sharpness',()=>{
 expect(resolutionUses(320,180).filter(item=>item.ok).map(item=>item.name)).toEqual(['Thumbnail']);
 expect(resolutionUses(1920,1080).filter(item=>item.ok)).toHaveLength(3);
 expect(resolutionUses(3840,2160).every(item=>item.ok)).toBe(true);
 expect(resolutionUses(0,0).some(item=>item.ok)).toBe(false);
 });
});
