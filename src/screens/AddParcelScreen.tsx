/** Add parcel (UI team): smart paste, live validation, ranked carrier candidates, nickname, pal picker. */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Carrier, CarrierMatch, CharacterKind } from '@/types';
import type { ProbeResult } from '@/engine';
import { autoCharacter, carriersForPicker, detectCarriers, getCarrier, normalizeTrackingNumber, supportsLiveTracking } from '@/engine';
import { actions, useParcels, useSettings } from '@/store';
import { Character, CharacterPicker } from '@/characters';
import { requestNotificationPermission } from '@/pwa';
import { href, navigate } from '@/router';
import { hasKey } from '@/i18n';
import { useT } from '@/i18n/useT';
import { Button, TopBar } from '@/components/ui';
import { SpeechBubble, Spinner, TextField } from '@/components/kit';
import { Icon } from '@/components/Icon';
import { carrierName } from '@/components/parcelInfo';
import { extractNumbers, looksLikeMessage, numberProblem, prettyNumber, type Extracted } from './add/extract';
import './add/add.css';

const canReadClipboard = () => typeof navigator !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.readText === 'function';
const notifPermission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** Process raw input: a whole message is reduced to the number(s) it contains. */
function digest(raw: string): { text: string; found: Extracted[] | null } {
  if (!looksLikeMessage(raw)) return { text: raw, found: null };
  const found = extractNumbers(raw);
  if (!found.length) return { text: raw, found: [] };
  return { text: found[0].trackingNumber, found };
}

export default function AddParcelScreen({ prefill }: { prefill?: string }) {
  const { t, locale } = useT();
  const settings = useSettings();
  const all = useParcels({ includeArchived: true });
  const initial = useMemo(() => digest(prefill ?? ''), [prefill]);
  const [text, setText] = useState(initial.text);
  const [found, setFound] = useState<Extracted[] | null>(initial.found);
  const [manual, setManual] = useState<{ id: string; via: 'chip' | 'select' } | null>(null);
  const [nickname, setNickname] = useState('');
  const [pal, setPal] = useState<CharacterKind | 'auto'>(settings.defaultCharacter);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lengthCheck, setLengthCheck] = useState(!!prefill);
  const [pasteError, setPasteError] = useState(false);
  const [exIdx] = useState(() => 1 + Math.floor(Math.random() * 4));
  const inputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();
  const candId = useId();

  const number = normalizeTrackingNumber(text.trim());
  const unparsedMessage = found !== null && found.length === 0;
  const problem = !number || unparsedMessage ? null : numberProblem(number);
  const duplicate = number && !problem ? all.find((p) => p.trackingNumber === number) : undefined;

  // Debounce "too short/long" so it doesn't nag mid-typing.
  useEffect(() => {
    setLengthCheck(false);
    if (!number) return;
    const tm = setTimeout(() => setLengthCheck(true), 900);
    return () => clearTimeout(tm);
  }, [number]);

  // A chip-picked carrier is forgotten when the number changes (a select-picked one is a deliberate choice).
  const lastNumber = useRef(number);
  useEffect(() => {
    if (lastNumber.current !== number) {
      lastNumber.current = number;
      setManual((m) => (m?.via === 'chip' ? null : m));
      setSubmitError(null);
    }
  }, [number]);

  const candidates: CarrierMatch[] = useMemo(() => {
    if (!number || problem) return [];
    let list: CarrierMatch[] = [];
    try { list = detectCarriers(number, { region: settings.region }); } catch { list = []; }
    const hinted = found?.find((f) => f.trackingNumber === number)?.carrierId;
    const hc = hinted ? getCarrier(hinted) : undefined;
    if (hc && !list.some((m) => m.carrier.id === hc.id)) list = [{ carrier: hc, confidence: 0.9 }, ...list];
    return list.slice(0, 4);
  }, [number, problem, found, settings.region]);

  // Auto-confirm: when the number fits several carriers, ask the top candidates live which one has records.
  const [probe, setProbe] = useState<{ number: string; results: ProbeResult[] | null } | null>(null);
  const ambiguous = candidates.length >= 2 && candidates[0].confidence < 0.9;
  const candidateKey = candidates.map((m) => m.carrier.id).join(',');
  useEffect(() => {
    if (!ambiguous || !number) { setProbe(null); return; }
    let alive = true;
    const timer = setTimeout(() => {
      setProbe({ number, results: null });
      actions.probeCarriers(number, candidateKey.split(',')).then((results) => {
        if (alive) setProbe({ number, results });
      }).catch(() => { if (alive) setProbe(null); });
    }, 450);
    return () => { alive = false; clearTimeout(timer); };
  }, [ambiguous, number, candidateKey]);
  const probeFor = (id: string) => (probe?.number === number ? probe.results?.find((r) => r.carrierId === id) : undefined);
  const probing = probe?.number === number && probe.results === null;
  const probeHit = probe?.number === number ? probe.results?.find((r) => r.result === 'found') : undefined;
  const probeNone = probe?.number === number && !!probe.results && !probeHit;

  const carrierId = manual?.id ?? probeHit?.carrierId ?? candidates[0]?.carrier.id ?? '';
  const carrier: Carrier | undefined = carrierId ? getCarrier(carrierId) : undefined;
  const palKind: CharacterKind = pal === 'auto' ? autoCharacter(carrier) : pal;
  const firstAdd = all.length === 0;
  const willAskNotify = firstAdd && settings.notifications && notifPermission() === 'default';
  const canSubmit = !!number && !problem && !unparsedMessage && !duplicate && !!carrierId && !submitting;

  const onInput = (raw: string) => {
    setPasteError(false);
    if (found && found.length > 0 && found.some((f) => f.trackingNumber === normalizeTrackingNumber(raw))) { setText(raw); return; }
    const d = digest(raw);
    setText(d.text); setFound(d.found);
  };
  const paste = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) onInput(clip);
      inputRef.current?.focus();
    } catch { setPasteError(true); }
  };
  const clear = () => { setText(''); setFound(null); setPasteError(false); setSubmitError(null); inputRef.current?.focus(); };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) { setLengthCheck(true); return; }
    setSubmitting(true); setSubmitError(null);
    try {
      const parcel = await actions.addParcel({
        trackingNumber: number, carrierId, nickname: nickname.trim() || undefined, character: palKind,
      });
      if (willAskNotify) void requestNotificationPermission().catch(() => undefined);
      navigate('/p/' + encodeURIComponent(parcel.id), { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setSubmitError(msg && hasKey(msg, locale) ? t(msg) : t('ui.add.err.failed'));
      setSubmitting(false);
    }
  };

  // ── error text (one at a time) ──
  let error: ReactNode = null;
  if (submitError) error = submitError;
  else if (unparsedMessage) error = t('ui.add.err.notFound');
  else if (duplicate) error = (
    <span>{t('ui.add.err.duplicate')} <a className="add-dup-link" href={href('/p/' + encodeURIComponent(duplicate.id))}>{t('ui.add.err.duplicateLink')} <Icon name="chevronRight" size={14} /></a></span>
  );
  else if (problem === 'chars') error = t('ui.add.err.chars');
  else if (problem && lengthCheck) error = t(`ui.add.err.${problem}`);
  else if (pasteError) error = t('ui.add.pasteFailed');

  let palSays = t('ui.add.carrier.waiting');
  let palMood: 'idle' | 'happy' | 'waiting' | 'worried' = 'idle';
  if (number && !problem && !unparsedMessage) {
    if (manual && carrier) { palSays = t('ui.add.carrier.manual', { name: carrierName(carrier.id, locale) }); palMood = 'happy'; }
    else if (probing) { palSays = t('ui.add.carrier.probing'); palMood = 'waiting'; }
    else if (probeHit) { palSays = t('ui.add.carrier.probeFound', { name: carrierName(probeHit.carrierId, locale) }); palMood = 'happy'; }
    else if (probeNone && candidates[0]) { palSays = t('ui.add.carrier.probeNone', { name: carrierName(candidates[0].carrier.id, locale) }); palMood = 'idle'; }
    else if (candidates[0]) { palSays = t('ui.add.carrier.guess', { name: carrierName(candidates[0].carrier.id, locale) }); palMood = 'happy'; }
    else { palSays = t('ui.add.carrier.unknown'); palMood = 'worried'; }
  }

  // The user's own country first (Korean carriers in Korea, FedEx/UPS/USPS/Amazon in the US).
  const { domestic, other: intl } = carriersForPicker(settings.region);
  const us = settings.region === 'US';
  const examples = [1, 2, 3, 4].map((i) => t(`ui.add.nickname.ex${i}`));

  return (
    <main className="ui-screen add">
      <TopBar back title={t('ui.add.title')} />
      <form className="add-form" onSubmit={submit} noValidate>
        <TextField
          big label={t('ui.add.number.label')} value={text} onChange={(e) => onInput(e.target.value)}
          onBlur={() => number && setLengthCheck(true)}
          placeholder={t('ui.add.number.placeholder')} inputMode="text" autoComplete="off" autoCapitalize="characters" spellCheck={false}
          autoFocus enterKeyHint="next" data-testid="tracking-input" inputRef={inputRef}
          hint={t('ui.add.number.hint')} error={error} errorTestId="add-error"
          trailing={
            <>
              {text && <button type="button" className="add-clear" aria-label={t('ui.add.clear')} onClick={clear}><Icon name="close" size={18} /></button>}
              {canReadClipboard() && (
                <Button size="sm" variant="secondary" icon="clipboard" className="add-paste" data-testid="paste-button" onClick={paste}>{t('ui.add.paste')}</Button>
              )}
            </>
          }
        />

        {found && found.length > 0 && (
          <div className="add-found" role="group" aria-label={found.length > 1 ? t('ui.add.found.many', { n: found.length }) : t('ui.add.found.one')}>
            <p className="add-found__msg"><Icon name="sparkle" size={16} />{found.length > 1 ? t('ui.add.found.many', { n: found.length }) : t('ui.add.found.one')}</p>
            {found.length > 1 && (
              <div className="add-chips">
                {found.slice(0, 5).map((f) => (
                  <button key={f.trackingNumber} type="button" className="add-chip add-chip--num" aria-pressed={f.trackingNumber === number}
                    onClick={() => setText(f.trackingNumber)}>
                    {f.trackingNumber === number && <Icon name="check" size={16} />}
                    <span className="add-chip__num">{prettyNumber(f.trackingNumber)}</span>
                    {f.carrierId && getCarrier(f.carrierId) && <span className="add-chip__sub">{carrierName(f.carrierId, locale)}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {number && !problem && text.trim() !== prettyNumber(number) && text.trim() !== number && (
          <p className="add-normalized">{t('ui.add.normalized')} <strong className="font-display">{prettyNumber(number)}</strong></p>
        )}

        <section className="add-card" aria-labelledby={candId}>
          <h2 id={candId} className="add-card__title">{t('ui.add.carrier.label')}</h2>
          <div className="add-pal" aria-live="polite">
            <Character kind={palKind} mood={palMood} size={60} />
            <SpeechBubble tail="left" className="add-pal__say">{palSays}</SpeechBubble>
          </div>
          {candidates.length > 0 && (
            <div className="add-chips" role="group" aria-label={t('ui.add.carrier.candidates')}>
              {candidates.map((m, i) => {
                const on = m.carrier.id === carrierId;
                const pr = probeFor(m.carrier.id);
                const best = probeHit ? m.carrier.id === probeHit.carrierId : i === 0 && candidates.length > 1;
                return (
                  <button key={m.carrier.id} type="button" className="add-chip" data-testid="carrier-candidate" data-carrier-id={m.carrier.id}
                    data-probe={probing ? 'checking' : pr?.result}
                    aria-pressed={on} onClick={() => setManual({ id: m.carrier.id, via: 'chip' })}
                    style={m.carrier.color ? { ['--chip-c' as string]: m.carrier.color } : undefined}>
                    {on ? <Icon name="check" size={16} /> : <span className="add-chip__dot" aria-hidden="true" />}
                    {carrierName(m.carrier.id, locale)}
                    {probing && <Spinner size={14} />}
                    {pr?.result === 'found' && <span className="add-chip__found">{t('ui.add.carrier.hasRecord')}</span>}
                    {pr && pr.result !== 'found' && pr.result !== 'error' && pr.result !== 'unsupported' && <span className="add-chip__none">{t('ui.add.carrier.noRecord')}</span>}
                    {!pr && best && <span className="add-chip__best">{t('ui.add.carrier.best')}</span>}
                  </button>
                );
              })}
            </div>
          )}
          <label className="add-select" htmlFor={selectId}>
            <span className="add-select__label">{t('ui.add.carrier.other')}</span>
            <span className="add-select__box">
              <select id={selectId} data-testid="carrier-select" value={carrierId} onChange={(e) => e.target.value && setManual({ id: e.target.value, via: 'select' })}>
                <option value="" disabled>{t('ui.add.carrier.otherLabel')}</option>
                <optgroup label={t(us ? 'ui.add.carrier.domesticUS' : 'ui.add.carrier.domestic')}>
                  {domestic.map((c) => <option key={c.id} value={c.id}>{locale === 'ko' ? c.nameKo : c.nameEn}</option>)}
                </optgroup>
                {intl.length > 0 && (
                  <optgroup label={t(us ? 'ui.add.carrier.otherUS' : 'ui.add.carrier.international')}>
                    {intl.map((c) => <option key={c.id} value={c.id}>{locale === 'ko' ? c.nameKo : c.nameEn}</option>)}
                  </optgroup>
                )}
              </select>
              <Icon name="chevronDown" size={18} />
            </span>
          </label>
          {carrier && !supportsLiveTracking(carrier.id) && (
            <p className="add-unsupported" data-testid="add-unsupported">
              <Icon name="info" size={18} />
              <span>{t('ui.add.unsupported', { carrier: locale === 'ko' ? carrier.nameKo : carrier.nameEn })}</span>
            </p>
          )}
        </section>

        <section className="add-card">
          <TextField
            label={t('ui.add.nickname.label')} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40}
            placeholder={t('ui.add.nickname.placeholder', { ex: t(`ui.add.nickname.ex${exIdx}`) })} data-testid="nickname-input" enterKeyHint="done"
          />
          <div className="add-chips add-chips--ideas" role="group" aria-label={t('ui.add.nickname.ideas')}>
            {examples.map((ex) => (
              <button key={ex} type="button" className="add-chip add-chip--idea" aria-pressed={nickname === ex} onClick={() => setNickname(ex)}>{ex}</button>
            ))}
          </div>
        </section>

        <section className="add-card">
          <h2 className="add-card__title">{t('ui.add.pal.label')}</h2>
          <div className="add-picker">
            <CharacterPicker value={pal} onChange={setPal} includeAuto label={t('ui.add.pal.label')} />
          </div>
        </section>

        <div className="add-submit">
          {willAskNotify && canSubmit && <p className="add-submit__hint"><Icon name="bell" size={16} />{t('ui.add.notifyHint')}</p>}
          <Button type="submit" block data-testid="submit-add" disabled={!canSubmit} aria-busy={submitting}>
            {submitting ? <><Spinner size={18} />{t('ui.add.submitting')}</> : <><Icon name="plus" size={20} />{t('ui.add.submit')}</>}
          </Button>
        </div>
      </form>
    </main>
  );
}
