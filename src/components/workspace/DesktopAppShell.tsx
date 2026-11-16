import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Grid2x2Plus, Wallet, Phone, Settings, Star, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import '@/styles/desktop-app.css';

const destinations = [
  { label: 'Workspace', path: '/', icon: Bot },
  { label: 'Integrations', path: '/settings/apps', icon: Grid2x2Plus },
  { label: 'Wallet', path: '/wallet', icon: Wallet },
  { label: 'Phone', path: '/settings/phone', icon: Phone },
  { label: 'Plans', path: '/settings/plans', icon: Star },
  { label: 'Settings', path: '/settings', icon: Settings },
];

/** One account and existing routes; desktop adds navigation, never duplicate screens. */
export function DesktopAppShell({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [compact, setCompact] = useState(false);
  const active = destinations.some(({ path }) => path === pathname) || pathname === '/index' || pathname.startsWith('/settings/');
  const enabled = signedIn && active;
  return <div className="ceyo-app-frame" data-desktop-enabled={enabled || undefined} data-compact={compact || undefined}>
    {enabled && <nav className="ceyo-desktop-rail" aria-label="Desktop navigation">
      <Button variant="ghost" className="ceyo-desktop-brand" onClick={() => navigate('/')} title="Ceyo workspace"><Bot size={24} /><span>Ceyo</span></Button>
      <div className="ceyo-desktop-links">{destinations.map(({ label, path, icon: Icon }) => {
        const selected = path === '/' ? pathname === '/' || pathname === '/index' : path === '/settings' ? pathname === '/settings' : pathname.startsWith(path);
        return <Button key={path} variant="ghost" className="ceyo-desktop-link" aria-current={selected ? 'page' : undefined} title={label} onClick={() => navigate(path)}><Icon size={19} /><span>{label}</span></Button>;
      })}</div>
      <Button variant="ghost" className="ceyo-desktop-collapse" title={compact ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCompact((value) => !value)}>{compact ? <PanelLeftOpen /> : <PanelLeftClose />}<span>Collapse</span></Button>
    </nav>}
    <div className="ceyo-app-screen">{children}</div>
  </div>;
}