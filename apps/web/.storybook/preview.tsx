import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/react-vite';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/styles/globals.css';

// Widths from DESIGN.md Layout › Responsive. `wide-rail` is the 1200–1439px
// range where the navigation collapses to a 64px rail.
const viewports = {
  compact: {
    name: 'compact (390px)',
    styles: { width: '390px', height: '844px' },
  },
  medium: {
    name: 'medium (1024px)',
    styles: { width: '1024px', height: '768px' },
  },
  'wide-rail': {
    name: 'wide · rail (1280px)',
    styles: { width: '1280px', height: '800px' },
  },
  wide: { name: 'wide (1440px)', styles: { width: '1440px', height: '900px' } },
};

const preview: Preview = {
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    viewport: { options: viewports },
    a11y: { test: 'error' },
    backgrounds: { disable: true },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
    withThemeByDataAttribute<ReactRenderer>({
      themes: { light: 'light', dark: 'dark' },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
