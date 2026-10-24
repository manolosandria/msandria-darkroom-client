import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {useState} from 'react';
import {BannerSlideLink} from '../BannerSlideLink';
import {defaultHomeBanner,HomeBanner} from '@/src/domain/entities/HomeBanner';
vi.mock('@/src/infrastructure/catalogServices',()=>({editCatalog:{load:vi.fn().mockResolvedValue({categories:[{id:'city',name:'City'}],collections:[{id:'travel',title:'Travel'}],works:[],photos:[]})}}));
function Harness(){const[banner,setBanner]=useState<HomeBanner>(defaultHomeBanner);return <BannerSlideLink photoId="a" title="A photograph" banner={banner} onChange={slides=>setBanner({...banner,slides})}/>;}
describe('Slide destinations',()=>{
 it('offers public category and collection links and editable external HTTPS destinations',async()=>{
 render(<Harness/>);
 await waitFor(()=>expect(screen.getByRole('option',{name:'Gallery category'})).not.toBeDisabled());
 await screen.findByText(/Destination:/);
 fireEvent.change(screen.getByLabelText('Link destination'),{target:{value:'category'}});
 expect(await screen.findByLabelText('Category')).toHaveValue('city');
 expect(screen.getByText(/Destination:/)).toHaveTextContent('/gallery?category=city');
 fireEvent.change(screen.getByLabelText('Link destination'),{target:{value:'collection'}});
 expect(await screen.findByLabelText('Collection')).toHaveValue('travel');
 fireEvent.change(screen.getByLabelText('Link destination'),{target:{value:'external'}});
 fireEvent.change(screen.getByLabelText('HTTPS URL'),{target:{value:'https://www.instagram.com/photographer/'}});
 fireEvent.change(screen.getByLabelText('Caption text'),{target:{value:'Follow my work'}});
 expect(screen.getByLabelText('Caption text')).toHaveValue('Follow my work');
 expect(screen.getByText(/Destination:/)).toHaveTextContent('https://www.instagram.com/photographer/');
 });
});
