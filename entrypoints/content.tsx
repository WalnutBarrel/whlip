
import { createRoot } from 'react-dom/client';
import React from 'react';
import OverlayRenderer from '../components/OverlayRenderer';
import '../assets/tailwind.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'ghost-ui-overlay',
      position: 'inline',
      anchor: 'body',
      append: 'first',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<OverlayRenderer />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    ui.mount();
  },
});
