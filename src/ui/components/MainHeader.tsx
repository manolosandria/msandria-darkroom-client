'use client';

import Image from "next/image";
import Link from "next/link";

export default function MainHeader() {

    return (
      <header className="bg-gray-100 py-4 md:py-6 flex md:flex-row flex-col items-center justify-between px-8">
        <Image src="/images/branding/manolo-logo-black.svg" alt="Manolo Sandria Fotografía"
          width={384} height={96}
          className="w-64 md:w-96 lg:w-[24rem] h-auto py-2 md:py-0"
        />
        <nav className="flex flex-col md:flex-row items-center md:space-x-10 text-lg font-semibold text-gray-700">
          <Link href="/">Home</Link>
          <Link href="/gallery">Gallery</Link>
          <a href="#">Contact</a>
          <Link href="/upload">Add photos</Link>
        </nav>
      </header>
    );
}