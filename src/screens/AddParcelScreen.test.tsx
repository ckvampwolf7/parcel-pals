import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Parcel } from '@/types';

let mockParcels: Parcel[] = [];
vi.mock('@/store', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/store')>();
  return { ...mod, useParcels: () => mockParcels };
});
vi.mock('@/pwa', () => ({ requestNotificationPermission: vi.fn(async () => 'denied') }));

import { actions } from '@/store';
import AddParcelScreen from './AddParcelScreen';

const input = () => screen.getByTestId('tracking-input') as HTMLInputElement;
const submit = () => screen.getByTestId('submit-add') as HTMLButtonElement;

describe('AddParcelScreen', () => {
  beforeEach(() => { mockParcels = []; window.location.hash = '#/add'; });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('starts disabled and flags invalid characters right away', () => {
    render(<AddParcelScreen />);
    expect(submit()).toBeDisabled();
    fireEvent.change(input(), { target: { value: 'abc-defgh!' } });
    expect(screen.getByTestId('add-error')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it('flags a too-short number after a pause (not mid-typing)', () => {
    vi.useFakeTimers();
    render(<AddParcelScreen />);
    fireEvent.change(input(), { target: { value: '1234' } });
    expect(screen.queryByTestId('add-error')).toBeNull();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('add-error')).toBeInTheDocument();
    expect(submit()).toBeDisabled();
  });

  it('detects carriers, lets the user pick one and submits', async () => {
    const add = vi.spyOn(actions, 'addParcel').mockResolvedValue({ id: 'new1' } as Parcel);
    render(<AddParcelScreen />);
    fireEvent.change(input(), { target: { value: '6123-4567-8901' } });
    const chips = screen.getAllByTestId('carrier-candidate');
    expect(chips.length).toBeGreaterThan(0);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    let expected = chips[0].getAttribute('data-carrier-id');
    if (chips.length > 1) {
      fireEvent.click(chips[1]);
      expect(chips[1]).toHaveAttribute('aria-pressed', 'true');
      expect(chips[0]).toHaveAttribute('aria-pressed', 'false');
      expected = chips[1].getAttribute('data-carrier-id');
    }
    expect((screen.getByTestId('carrier-select') as HTMLSelectElement).value).toBe(expected);
    fireEvent.change(screen.getByTestId('nickname-input'), { target: { value: '운동화' } });
    expect(submit()).toBeEnabled();
    await act(async () => { fireEvent.click(submit()); });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ trackingNumber: '612345678901', carrierId: expected, nickname: '운동화' }));
    expect(window.location.hash).toBe('#/p/new1');
  });

  it('manual carrier select overrides detection', () => {
    render(<AddParcelScreen />);
    fireEvent.change(input(), { target: { value: '612345678901' } });
    const select = screen.getByTestId('carrier-select') as HTMLSelectElement;
    const other = [...select.options].find((o) => o.value && o.value !== select.value)!;
    fireEvent.change(select, { target: { value: other.value } });
    expect(select.value).toBe(other.value);
  });

  it('pulls the number out of a pasted message', () => {
    render(<AddParcelScreen />);
    fireEvent.change(input(), { target: { value: '[CJ대한통운] 고객님의 상품이 발송되었습니다. 운송장번호: 6123-4567-8901 문의 1588-1255' } });
    expect(input().value.replace(/\D/g, '')).toBe('612345678901');
    expect(screen.queryByTestId('add-error')).toBeNull();
  });

  it('prefills from a shared message', () => {
    render(<AddParcelScreen prefill={'주문하신 상품 송장번호 612345678901 입니다'} />);
    expect(input().value.replace(/\D/g, '')).toBe('612345678901');
  });

  it('warns about duplicates with a link to the parcel', () => {
    mockParcels = [{ id: 'dup', trackingNumber: '612345678901' } as Parcel];
    render(<AddParcelScreen />);
    fireEvent.change(input(), { target: { value: '612345678901' } });
    const err = screen.getByTestId('add-error');
    expect(err.querySelector('a')).toHaveAttribute('href', '#/p/dup');
    expect(submit()).toBeDisabled();
  });
});
