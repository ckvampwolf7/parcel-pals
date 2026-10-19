import '@testing-library/jest-dom/vitest';
import { __setDetectedRegionForTests } from '@/engine/region';
// Tests run under TZ=Asia/Seoul in CI and sometimes a US zone locally: pin the auto-detected region to Korea
// so defaults (language, carriers) don't depend on the machine. Region tests pass explicit environments.
__setDetectedRegionForTests('KR');
