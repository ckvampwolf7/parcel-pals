import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Parcel } from '@/types';

let mockParcels: Parcel[] = [];
vi.mock('@/store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/store')>();
  return { ...mod, useParcels: () => mockParcels };
});
import { actions, simNow } from '@/store';
import HomeScreen from './HomeScreen';

const mk = (id: string, status: 'in_transit' | 'out_for_delivery' | 'delivered', unread = 0): Parcel => ({
  id, trackingNumber: id, carrierId: 'kr.cjlogistics', nickname: 'N-' + id, character: 'truck', createdAt: simNow().toISOString(),
  archived: false, unread,
  snapshot: {
    status, progress: status === 'delivered' ? 1 : 0.5, currentStopIndex: 1, currentMode: 'truck', stops: [], updatedAt: simNow().toISOString(),
    checkpoints: [{ id: id + 'c', time: simNow().toISOString(), status, location: { ko: '서울', en: 'Seoul' }, message: { ko: '간선하차', en: 'Arrived' } }],
  },
});

describe('HomeScreen', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the empty state with both CTAs', async () => {
    mockParcels = [];
    const load = vi.spyOn(actions, 'loadDemo').mockResolvedValue();
    render(<HomeScreen />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('add-button')).toHaveAttribute('href', '#/add');
    await act(async () => { fireEvent.click(screen.getByTestId('load-demo-button')); });
    expect(load).toHaveBeenCalled();
  });

  it('renders each parcel once with status + unread dot, delivered section collapsible', () => {
    mockParcels = [mk('a', 'in_transit', 2), mk('b', 'out_for_delivery'), mk('c', 'delivered')];
    render(<HomeScreen />);
    const cards = screen.getAllByTestId('parcel-card');
    expect(cards.map((c) => c.getAttribute('data-parcel-id')).sort()).toEqual(['a', 'b', 'c']);
    const a = cards.find((c) => c.getAttribute('data-parcel-id') === 'a')!;
    expect(a.getAttribute('data-status')).toBe('in_transit');
    expect(a.querySelector('[data-testid="unread-dot"]')).not.toBeNull();
    expect(cards.find((c) => c.getAttribute('data-parcel-id') === 'b')!.querySelector('[data-testid="unread-dot"]')).toBeNull();
    expect(screen.getAllByTestId('add-button')).toHaveLength(1);
    const toggle = screen.getByRole('button', { expanded: true });
    fireEvent.click(toggle);
    expect(screen.getAllByTestId('parcel-card')).toHaveLength(2);
  });

  it('refresh-all calls the store', async () => {
    mockParcels = [mk('a', 'in_transit')];
    const ref = vi.spyOn(actions, 'refreshAll').mockResolvedValue();
    render(<HomeScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId('refresh-all')); });
    expect(ref).toHaveBeenCalled();
  });
});
