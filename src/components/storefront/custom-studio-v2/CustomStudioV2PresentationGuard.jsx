import React from 'react';
import CustomStudioV2 from '@/pages/CustomStudioV2';
import CustomStudioV2GarmentFocus from './CustomStudioV2GarmentFocus';
import './customStudioV2MobileRepair.css';
import './customStudioV2GarmentFocus.css';

/**
 * Presentation-only boundary for the rebuilt Custom Studio.
 *
 * Keep mobile containment/rendering fixes outside editor state, production
 * composition, pricing, uploads and cart wiring so a visual repair cannot
 * silently change customer design data or fulfillment behavior.
 */
export default function CustomStudioV2PresentationGuard() {
  return (
    <div data-gdp-studio-v2-guard="true" className="min-w-0 max-w-full overflow-x-clip">
      <CustomStudioV2 />
      <CustomStudioV2GarmentFocus />
    </div>
  );
}
