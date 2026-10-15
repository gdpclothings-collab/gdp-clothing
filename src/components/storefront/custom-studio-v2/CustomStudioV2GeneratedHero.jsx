import React, { useState } from 'react';
import CustomStudioV2HeroArt from './CustomStudioV2HeroArt';

// The generated promo art is purely decorative. Missing assets cannot hide the banner.
export default function CustomStudioV2GeneratedHero() {
  const [failed, setFailed] = useState(false);
  return failed
    ? <CustomStudioV2HeroArt />
    : <img
        src="/images/custom-studio/gallery/hero-merch.webp"
        alt=""
        width="1132"
        height="696"
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-center"
      />;
}
