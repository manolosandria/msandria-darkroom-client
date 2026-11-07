import { Suspense } from 'react';
import HomePage from '@/src/ui/components/HomePage';
import HomePosts from '@/src/ui/components/HomePosts';
import MainHeader from '@/src/ui/components/MainHeader';

export default function Home() {
  return (
    <>
      <MainHeader />
      <HomePage />
      {/* The posts read `?page=` and `?tag=`, so they render in the browser. */}
      <Suspense fallback={null}>
        <HomePosts />
      </Suspense>
    </>
  );
}
