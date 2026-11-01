import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent} from '@testing-library/react';
import {useState} from 'react';
import {BannerSlideLink} from '../BannerSlideLink';
import {choose,chooseWhenReady} from './chooseOption';
import {defaultHomeBanner,HomeBanner} from '@/src/domain/entities/HomeBanner';
vi.mock('@/src/infrastructure/catalogServices',()=>({editCatalog:{load:vi.fn().mockResolvedValue({categories:[{id:'city',name:'City'}],collections:[{id:'travel',title:'Travel'}],works:[],photos:[]})}}));
function Harness(){const[banner,setBanner]=useState<HomeBanner>(defaultHomeBanner);return <BannerSlideLink photoId="a" title="A photograph" banner={banner} onChange={slides=>setBanner({...banner,slides})}/>;}
describe('Slide destinations',()=>{
 it('offers public category and collection links and editable external HTTPS destinations',async()=>{
 render(<Harness/>);
 await screen.findByText(/Destination:/);
 await chooseWhenReady(screen.getByLabelText('Link destination'),'Gallery category');
 expect(await screen.findByLabelText('Category')).toHaveTextContent('City');
 expect(screen.getByText(/Destination:/)).toHaveTextContent('/gallery?category=city');
 choose(screen.getByLabelText('Link destination'),'Collection');
 expect(await screen.findByLabelText('Collection')).toHaveTextContent('Travel');
 choose(screen.getByLabelText('Link destination'),'External website');
 fireEvent.change(screen.getByLabelText('HTTPS URL'),{target:{value:'https://www.instagram.com/photographer/'}});
 fireEvent.change(screen.getByLabelText('Slide title'),{target:{value:'Follow my work'}});
 expect(screen.getByLabelText('Slide title')).toHaveValue('Follow my work');
 expect(screen.getByText(/Destination:/)).toHaveTextContent('https://www.instagram.com/photographer/');
 });
 it('edits an existing slide in place, keeping the carousel order',async()=>{
 const onChange=vi.fn();
 const banner={...defaultHomeBanner,slides:[{photoId:'a',text:'A',href:'/gallery'},{photoId:'b',text:'B',href:'/gallery'}]};
 render(<BannerSlideLink photoId="a" title="A" banner={banner} onChange={onChange}/>);
 fireEvent.change(await screen.findByLabelText('Slide title'),{target:{value:'Renamed'}});
 expect(onChange).toHaveBeenLastCalledWith([{photoId:'a',text:'Renamed',href:'/gallery'},{photoId:'b',text:'B',href:'/gallery'}]);
 });
});
