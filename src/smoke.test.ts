import { detectCarriers, mockProvider } from '@/engine';
import { t } from '@/i18n';
test('scaffold smoke', async () => {
  expect(detectCarriers('1Z999AA10123456784')[0].carrier.id).toBe('us.ups');
  const snap = await mockProvider.track({ trackingNumber: 'X', carrierId: 'kr.cjlogistics', createdAt: new Date(0).toISOString() }, new Date(10 * 3.6e6));
  expect(snap.checkpoints.length).toBeGreaterThan(0);
  expect(t('common.appName', undefined, 'en')).toBe('Parcel Pals');
});
