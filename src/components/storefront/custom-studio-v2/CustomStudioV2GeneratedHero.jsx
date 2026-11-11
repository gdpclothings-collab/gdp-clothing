import React, { useState } from 'react';
import CustomStudioV2HeroArt from './CustomStudioV2HeroArt';
import { AURORA_IMAGES } from '@/lib/auroraTheme';

// The generated promo art is purely decorative. Missing assets cannot hide the banner.
export default function CustomStudioV2GeneratedHero() {
  const [failed, setFailed] = useState(false);
  return failed
    ? <CustomStudioV2HeroArt />
    : <img
        src={AURORA_IMAGES.studioHero}
        alt=""
        width="1132"
        height="696"
        loading="eager"
        decoding="async"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover object-center"
      />;
}
