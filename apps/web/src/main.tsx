import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import './styles/globals.css';

// Screens are built after packages/domain (AGENTS.md, ADR 0003). Until then
// the app renders nothing; the design system is reviewed in Storybook.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <main />
    </TooltipProvider>
  </StrictMode>,
);
