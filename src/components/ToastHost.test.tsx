import { act, fireEvent, render, screen } from '@testing-library/react';
import type { AppEvent, Parcel } from '@/types';

const listeners: Array<(e: AppEvent) => void> = [];
vi.mock('@/store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/store')>();
  return { ...mod, subscribe: (l: (e: AppEvent) => void) => { listeners.push(l); return () => { listeners.splice(listeners.indexOf(l), 1); }; } };
});

import { ToastHost, useStoreEventToasts } from './ToastHost';
import { showToast } from './toast';

function Host() { useStoreEventToasts(); return <ToastHost />; }

const parcel: Parcel = {
  id: 'p1', trackingNumber: '612345678901', carrierId: 'kr.cjlogistics', nickname: '새 운동화', character: 'truck',
  createdAt: '2026-10-16T00:00:00Z', archived: false, unread: 1,
  snapshot: { status: 'delivered', checkpoints: [], stops: [], progress: 1, currentStopIndex: 3, currentMode: 'truck', updatedAt: '2026-10-16T00:00:00Z' },
};

describe('ToastHost', () => {
  beforeEach(() => { vi.useFakeTimers(); window.location.hash = '#/'; });
  afterEach(() => { vi.useRealTimers(); });

  it('renders bus toasts, keeps max 2, auto-dismisses and closes on tap', () => {
    render(<ToastHost />);
    act(() => { showToast({ text: 'one', durationMs: 1000 }); showToast({ text: 'two' }); showToast({ text: 'three' }); });
    expect(screen.getAllByTestId('toast')).toHaveLength(2);
    expect(screen.queryByText('one')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /닫기|Dismiss/ })[0]);
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryAllByTestId('toast')).toHaveLength(0);
  });

  it('turns a store delivered event into a celebratory toast that navigates', () => {
    render(<Host />);
    act(() => {
      listeners.forEach((l) => l({ type: 'parcel-delivered', parcel }));
      vi.advanceTimersByTime(50);
    });
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveTextContent('새 운동화');
    fireEvent.click(toast.querySelector('button')!);
    expect(window.location.hash).toBe('#/p/p1');
  });
});
