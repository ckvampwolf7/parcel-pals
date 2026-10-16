import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Segmented, Switch } from './kit';

describe('kit', () => {
  it('Switch is a role=switch that toggles', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="알림" testId="sw" />);
    const sw = screen.getByRole('switch', { name: '알림' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Segmented supports click and arrow keys', () => {
    function Demo() {
      const [v, setV] = useState<'a' | 'b' | 'c'>('a');
      return <Segmented label="seg" value={v} onChange={setV} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B', testId: 'b' }, { value: 'c', label: 'C' }]} />;
    }
    render(<Demo />);
    fireEvent.click(screen.getByTestId('b'));
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
  });
});
