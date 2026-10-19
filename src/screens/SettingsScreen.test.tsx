import { act, fireEvent, render, screen, within } from '@testing-library/react';
vi.mock('@/pwa', () => ({ requestNotificationPermission: vi.fn(async () => 'granted') }));
import { actions } from '@/store';
import SettingsScreen from './SettingsScreen';

describe('SettingsScreen', () => {
  beforeEach(() => { actions.resetAll(); });
  afterEach(() => { vi.restoreAllMocks(); actions.resetAll(); });

  it('changes language, theme, motion, speed and default pal through actions', () => {
    const upd = vi.spyOn(actions, 'updateSettings');
    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId('setting-locale-en'));
    expect(upd).toHaveBeenCalledWith({ locale: 'en' });
    expect(screen.getByTestId('setting-locale-en')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('setting-theme-dark'));
    expect(upd).toHaveBeenCalledWith({ theme: 'dark' });
    fireEvent.click(screen.getByTestId('setting-reduce-motion-on'));
    expect(upd).toHaveBeenCalledWith({ reduceMotion: 'on' });
    fireEvent.change(screen.getByTestId('setting-demo-speed'), { target: { value: '1440' } });
    expect(upd).toHaveBeenCalledWith({ demoSpeed: 1440 });
    fireEvent.click(within(screen.getByTestId('setting-default-character')).getByTestId('character-option-bunny'));
    expect(upd).toHaveBeenCalledWith({ defaultCharacter: 'bunny' });
  });

  it('switches the home region', () => {
    const upd = vi.spyOn(actions, 'updateSettings');
    render(<SettingsScreen />);
    expect(screen.getByTestId('setting-region-KR')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('setting-region-US'));
    expect(upd).toHaveBeenCalledWith({ region: 'US' });
    expect(screen.getByTestId('setting-region-US')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles notifications', async () => {
    const upd = vi.spyOn(actions, 'updateSettings');
    render(<SettingsScreen />);
    const sw = screen.getByTestId('setting-notifications');
    expect(sw).toHaveAttribute('role', 'switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await act(async () => { fireEvent.click(sw); });
    expect(upd).toHaveBeenCalledWith({ notifications: false });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('asks before resetting all data', () => {
    const reset = vi.spyOn(actions, 'resetAll');
    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId('reset-data'));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-reset'));
    expect(reset).toHaveBeenCalled();
  });
});
