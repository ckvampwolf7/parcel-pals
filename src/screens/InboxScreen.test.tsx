import { fireEvent, render, screen } from '@testing-library/react';
import type { InboxItem, Parcel } from '@/types';

let mockInbox: InboxItem[] = [];
vi.mock('@/store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/store')>();
  return {
    ...mod,
    useInbox: () => mockInbox,
    useParcels: () => [{ id: 'p1', nickname: '새 운동화', character: 'truck', snapshot: null } as unknown as Parcel],
  };
});
import { actions, simNow } from '@/store';
import InboxScreen from './InboxScreen';

const item = (id: string, read: boolean): InboxItem => ({
  id, parcelId: 'p1', checkpointId: 'c' + id, time: simNow().toISOString(), status: 'in_transit', read,
  text: { ko: '허브에 도착했어요!', en: 'Arrived at the hub!' },
});

describe('InboxScreen', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('shows the empty state', () => {
    mockInbox = [];
    render(<InboxScreen />);
    expect(screen.getByTestId('inbox-empty')).toBeInTheDocument();
  });

  it('marks an item read and opens the parcel on tap', () => {
    mockInbox = [item('1', false), item('2', true)];
    const mark = vi.spyOn(actions, 'markInboxRead').mockImplementation(() => {});
    render(<InboxScreen />);
    const items = screen.getAllByTestId('inbox-item');
    expect(items).toHaveLength(2);
    expect(items.filter((i) => i.getAttribute('data-read') === 'false')).toHaveLength(1);
    fireEvent.click(items.find((i) => i.getAttribute('data-read') === 'false')!);
    expect(mark).toHaveBeenCalledWith(['1']);
    expect(window.location.hash).toBe('#/p/p1');
  });

  it('marks all read', () => {
    mockInbox = [item('1', false), item('2', false)];
    const mark = vi.spyOn(actions, 'markInboxRead').mockImplementation(() => {});
    render(<InboxScreen />);
    fireEvent.click(screen.getByTestId('mark-all-read'));
    expect(mark).toHaveBeenCalledWith();
  });
});
