import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Parcel, Settings } from '@/types';
import { fixtureParcel } from './fixtures';

// ── store mock: the screen only talks to the store through these names ──
const h = vi.hoisted(() => ({
  parcel: undefined as Parcel | undefined,
  settings: {
    locale: 'ko', defaultCharacter: 'auto', notifications: true, demoSpeed: 60, refreshIntervalSec: 15,
    theme: 'light', reduceMotion: 'off', onboarded: true,
  } as Settings,
  now: new Date('2026-10-15T13:00:00+09:00'),
}));
vi.mock('@/store', () => ({
  actions: {
    markSeen: vi.fn(), updateParcel: vi.fn(), removeParcel: vi.fn(),
    refresh: vi.fn(async () => {}), fastForward: vi.fn(async () => {}),
  },
  useParcel: () => h.parcel,
  useParcels: () => (h.parcel ? [h.parcel] : []),
  useSettings: () => h.settings,
  useSimNow: () => h.now,
  simNow: () => h.now,
  useReducedMotion: () => false,
  useInbox: () => [],
  subscribe: () => () => {},
}));
vi.mock('@/router', () => ({ navigate: vi.fn(), goBack: vi.fn(), href: (p: string) => '#' + p }));

import { actions } from '@/store';
import { navigate } from '@/router';
import ParcelScreen from '@/screens/ParcelScreen';

const show = (p: Parcel | undefined, locale: 'ko' | 'en' = 'ko') => {
  h.parcel = p;
  h.settings = { ...h.settings, locale };
  return render(<ParcelScreen id={p?.id ?? 'missing'} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  h.settings = { ...h.settings, locale: 'ko' };
});

describe('ParcelScreen', () => {
  it('shows a friendly not-found state with a way home', () => {
    show(undefined);
    expect(screen.getByText('이 택배를 찾을 수 없어요')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 가기' })).toHaveAttribute('href', '#/');
  });

  it('shows the waiting pal + skeleton while the carrier is being asked (snapshot null)', () => {
    show(fixtureParcel('domestic', { snapshot: null }));
    expect(screen.getByTestId('parcel-title')).toHaveTextContent('새 운동화');
    expect(screen.getByTestId('speech-bubble')).toHaveTextContent('택배사에 물어보는 중…');
    expect(screen.getByTestId('character')).toHaveAttribute('data-mood', 'waiting');
  });

  it('pending: no checkpoints yet, honest empty timeline', () => {
    show(fixtureParcel('pending'));
    expect(screen.getByTestId('status-chip')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('journey-scene')).toHaveAttribute('data-progress', '0');
    expect(screen.getByTestId('timeline')).toHaveTextContent('아직 소식이 없어요');
    expect(screen.queryAllByTestId('timeline-item')).toHaveLength(0);
  });

  it('international in transit: scene exposes progress, all stops, mode and a text equivalent', () => {
    const p = fixtureParcel('international');
    show(p, 'en');
    const scene = screen.getByTestId('journey-scene');
    expect(scene).toHaveAttribute('data-progress', '0.22');
    expect(scene).toHaveAttribute('data-status', 'in_transit');
    expect(within(scene).getByText('Incheon Customs')).toBeInTheDocument();
    expect(screen.getByText(/Journey map for Keyboard|Journey map for 해외 직구 키보드/)).toHaveTextContent('8 stops');
    expect(screen.getByTestId('eta')).toBeInTheDocument();
    expect(screen.getByTestId('speech-bubble')).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
  });

  it('timeline is newest first and grouped by day', () => {
    const p = fixtureParcel('domestic');
    show(p);
    const items = screen.getAllByTestId('timeline-item');
    const times = items.map((li) => new Date(li.querySelector('time')!.getAttribute('datetime')!).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(items[0]).toHaveAttribute('data-status', 'in_transit');
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBeGreaterThanOrEqual(1);
  });

  it('long timelines collapse with show all / show less, and raw carrier text is behind a toggle', () => {
    show(fixtureParcel('delivered'));
    expect(screen.getAllByTestId('timeline-item')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: /전체 보기/ }));
    expect(screen.getAllByTestId('timeline-item')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: '접기' }));
    expect(screen.getAllByTestId('timeline-item')).toHaveLength(5);
    expect(screen.queryByText('“배송완료”')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '원문 보기' }));
    expect(screen.getByText('“배송완료”')).toBeInTheDocument();
  });

  it('out for delivery: happy pal, scene progress', () => {
    show(fixtureParcel('out_for_delivery'));
    expect(screen.getByTestId('status-chip')).toHaveAttribute('data-status', 'out_for_delivery');
    expect(screen.getByTestId('journey-scene')).toHaveAttribute('data-progress', '0.86');
    const pal = within(screen.getByTestId('journey-scene')).getAllByTestId('character')[0];
    expect(pal).toHaveAttribute('data-mood', 'happy');
  });

  it('delivered: celebration and delivered header', () => {
    show(fixtureParcel('delivered'));
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(screen.getByTestId('journey-scene')).toHaveAttribute('data-progress', '1');
    expect(screen.getByTestId('eta')).toHaveTextContent('도착했어요');
  });

  it('exception: worried pal + warning sign; delayed shows badge and reason', () => {
    const { unmount } = show(fixtureParcel('exception'));
    const scene = screen.getByTestId('journey-scene');
    expect(scene.querySelector('.jr-warn')).not.toBeNull();
    expect(within(scene).getAllByTestId('character')[0]).toHaveAttribute('data-mood', 'worried');
    unmount();
    show(fixtureParcel('intl_customs_delayed'));
    expect(screen.getByText('지연 중')).toBeInTheDocument();
    expect(screen.getByText(/세관에서 꼼꼼히 확인하고 있어요/)).toBeInTheDocument();
  });

  it('handoff: shows the new domestic number and a helper pal; stale shows reassurance', () => {
    const { unmount } = show(fixtureParcel('intl_handoff'));
    expect(screen.getByTestId('handoff')).toHaveTextContent('5123 4567 8902');
    expect(within(screen.getByTestId('journey-scene')).getAllByTestId('character')).toHaveLength(2);
    unmount();
    show(fixtureParcel('stale'));
    expect(screen.getByText('한동안 소식이 없어요')).toBeInTheDocument();
  });

  it('marks the parcel seen on open and highlights unseen checkpoints', () => {
    const p = fixtureParcel('domestic', { unread: 2 });
    show(p);
    expect(actions.markSeen).toHaveBeenCalledWith(p.id);
    expect(screen.getAllByText('새 소식')).toHaveLength(2);
  });

  it('refresh and fast-forward call the store', async () => {
    const p = fixtureParcel('domestic');
    show(p);
    await act(async () => { fireEvent.click(screen.getByTestId('refresh-parcel')); });
    expect(actions.refresh).toHaveBeenCalledWith(p.id);
    await act(async () => { fireEvent.click(screen.getByTestId('fast-forward')); });
    expect(actions.fastForward).toHaveBeenCalledWith(3);
  });

  it('menu: rename, change pal, archive, delete call store actions', () => {
    const p = fixtureParcel('domestic');
    show(p);
    fireEvent.click(screen.getByTestId('parcel-menu'));
    fireEvent.change(screen.getByTestId('rename-input'), { target: { value: '엄마 선물' } });
    fireEvent.click(screen.getByTestId('rename-save'));
    expect(actions.updateParcel).toHaveBeenCalledWith(p.id, { nickname: '엄마 선물' });

    fireEvent.click(screen.getByTestId('parcel-menu'));
    fireEvent.click(screen.getByTestId('change-character'));
    fireEvent.click(screen.getByTestId('character-option-bunny'));
    expect(actions.updateParcel).toHaveBeenCalledWith(p.id, { character: 'bunny' });

    fireEvent.click(screen.getByTestId('parcel-menu'));
    fireEvent.click(screen.getByTestId('archive-parcel'));
    expect(actions.updateParcel).toHaveBeenCalledWith(p.id, { archived: true });

    fireEvent.click(screen.getByTestId('parcel-menu'));
    fireEvent.click(screen.getByTestId('delete-parcel'));
    expect(actions.removeParcel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    expect(actions.removeParcel).toHaveBeenCalledWith(p.id);
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('carrier link opens the carrier tracking page when the carrier has one', () => {
    show(fixtureParcel('domestic'));
    const link = screen.queryByTestId('carrier-link');
    if (link) expect(link.getAttribute('href')).toContain('612345678901');
  });
});
