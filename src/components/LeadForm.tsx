import { useEffect, useState, type ChangeEvent, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  duplicateCheckQuery,
  duplicateLookup,
  hasLookup,
  saveLead,
  statsQuery,
  type Duplicate,
  type DuplicateField,
  type DuplicateLookup,
  type LeadInput,
} from '../api';
import { BUSINESS_TYPES, CONFIG, DESIGNATIONS, LEAD_SOURCES, WEBSITE_PITCH, isConfigured } from '../config';
import { formatPhone, isValidEmail, normalizeAnyPhone, normalizePhone } from '../phone';

type FormState = {
  addedBy: string;
  business: string;
  contactName: string;
  designation: string;
  /** The first is the main (mobile) number; the rest are optional extra numbers. */
  phones: string[];
  email: string;
  socialLink: string;
  website: string;
  websitePitch: string;
  websiteNotes: string;
  city: string;
  area: string;
  businessType: string;
  leadSource: string;
  leadSourceOther: string;
  listingLink: string;
  notes: string;
};
type TextField = Exclude<keyof FormState, 'phones'>;
/** Each phone box has its own key: phone0 (main), phone1, phone2, ... */
type PhoneKey = `phone${number}`;
type ErrorKey = TextField | PhoneKey;
type Errors = Partial<Record<ErrorKey, string>>;

const phoneKey = (i: number): PhoneKey => `phone${i}`;

const ADDED_BY_KEY = 'scalehour.addedBy';

/** Wait this long after typing stops before searching the sheet. */
const CHECK_DELAY_MS = 500;

const DUPLICATE_ERRORS: Record<DuplicateField, string> = {
  business: 'A lead with this business name is already in the sheet.',
  email: 'This email is already in the sheet.',
  phone: 'This number is already in the sheet.',
};

const DUPLICATE_LABELS: Record<DuplicateField, string> = {
  business: 'business name',
  email: 'email',
  phone: 'phone number',
};

function savedName() {
  try {
    const name = localStorage.getItem(ADDED_BY_KEY) ?? '';
    return CONFIG.TEAM.includes(name) ? name : '';
  } catch {
    return '';
  }
}

/** Field order matches the form, top to bottom, so the first one with an error gets focus. */
const emptyForm = (addedBy: string): FormState => ({
  addedBy,
  business: '',
  contactName: '',
  designation: '',
  phones: [''],
  email: '',
  socialLink: '',
  website: '',
  websitePitch: '',
  websiteNotes: '',
  city: '',
  area: '',
  businessType: '',
  leadSource: '',
  leadSourceOther: '',
  listingLink: '',
  notes: '',
});

/** Fields top to bottom, with one entry per phone box. */
function fieldOrder(f: FormState): ErrorKey[] {
  return (Object.keys(f) as (keyof FormState)[]).flatMap((k) =>
    k === 'phones' ? f.phones.map((_, i) => phoneKey(i)) : [k],
  );
}

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.addedBy) e.addedBy = 'Select your name.';
  if (!f.business.trim()) e.business = 'Enter the business or company name.';
  if (!f.contactName.trim()) e.contactName = 'Enter the contact person’s name.';
  f.phones.forEach((raw, i) => {
    const key = phoneKey(i);
    if (i === 0) {
      if (!raw.trim()) e[key] = 'Enter the phone number.';
      else if (!normalizePhone(raw)) e[key] = 'Enter a valid 10-digit mobile number, starting with 6, 7, 8 or 9.';
      return;
    }
    if (!raw.trim()) return; // An empty extra box is just skipped.
    const digits = normalizeAnyPhone(raw);
    if (!digits) e[key] = 'Enter a 10-digit mobile, or a landline with its STD code.';
    else if (f.phones.slice(0, i).some((p) => normalizeAnyPhone(p) === digits)) e[key] = 'This number is already entered above.';
  });
  if (f.email.trim() && !isValidEmail(f.email.trim())) e.email = 'Enter a valid email, like name@company.com.';
  if (!f.websitePitch) e.websitePitch = 'Select whether we can pitch them a website.';
  if (!f.city.trim()) e.city = 'Enter the city.';
  if (!f.businessType) e.businessType = 'Select the business type.';
  if (!f.leadSource) e.leadSource = 'Select where this lead came from.';
  else if (f.leadSource === 'Other' && !f.leadSourceOther.trim()) e.leadSourceOther = 'Type the lead source.';
  return e;
}

/**
 * Keeps only the matches whose fields still hold the value that was searched for,
 * so an earlier result never flags a field that has since been changed.
 */
function stillMatching(
  result: { lookup: DuplicateLookup; duplicates: Duplicate[] } | undefined,
  current: DuplicateLookup,
): Duplicate[] {
  if (!result) return [];
  return result.duplicates
    .map((d) => {
      const phones = (d.phones ?? []).filter((p) => current.phones.includes(p));
      const matchedOn = d.matchedOn.filter((f) =>
        f === 'phone' ? phones.length > 0 : current[f] && current[f] === result.lookup[f],
      );
      return { ...d, matchedOn, phones };
    })
    .filter((d) => d.matchedOn.length > 0);
}

/** Puts the "already in the sheet" message under each field, and each phone box, that matched. */
function duplicateErrors(duplicates: Duplicate[], phones: string[]): Errors {
  const e: Errors = {};
  for (const d of duplicates) {
    for (const f of d.matchedOn) if (f !== 'phone') e[f] = DUPLICATE_ERRORS[f];
    phones.forEach((raw, i) => {
      const digits = normalizeAnyPhone(raw);
      if (digits && d.phones?.includes(digits)) e[phoneKey(i)] = DUPLICATE_ERRORS.phone;
    });
  }
  return e;
}

const leadLookup = (lead: LeadInput) => duplicateLookup({ ...lead, phones: [lead.phone, ...lead.otherPhones] });

/** "phone number 98765 43210" rather than just "phone number", since a lead can have several. */
const matchLabel = (d: Duplicate, f: DuplicateField) =>
  f === 'phone' && d.phones?.length ? `${DUPLICATE_LABELS.phone} ${d.phones.map(formatPhone).join(', ')}` : DUPLICATE_LABELS[f];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  // `value` is a new object on every render, so its JSON decides when it really changed.
  const key = JSON.stringify(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [key, ms]);
  return debounced;
}

function toLead(f: FormState): LeadInput {
  return {
    addedBy: f.addedBy,
    business: f.business.trim(),
    contactName: f.contactName.trim(),
    designation: f.designation,
    phone: normalizePhone(f.phones[0]),
    otherPhones: f.phones.slice(1).map(normalizeAnyPhone).filter(Boolean),
    email: f.email.trim(),
    website: f.website.trim(),
    websitePitch: f.websitePitch,
    websiteNotes: f.websiteNotes.trim(),
    city: f.city.trim(),
    area: f.area.trim(),
    businessType: f.businessType,
    leadSource: f.leadSource === 'Other' ? `Other: ${f.leadSourceOther.trim()}` : f.leadSource,
    listingLink: f.listingLink.trim(),
    socialLink: f.socialLink.trim(),
    notes: f.notes.trim(),
  };
}

export function LeadForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => emptyForm(savedName()));
  const [errors, setErrors] = useState<Errors>({});
  const [success, setSuccess] = useState('');
  const [failure, setFailure] = useState('');

  // Search the sheet for the business name, email and phone once typing pauses.
  const currentLookup = duplicateLookup(form);
  const lookup = useDebounced(currentLookup, CHECK_DELAY_MS);
  const check = useQuery({
    ...duplicateCheckQuery(lookup),
    enabled: isConfigured() && hasLookup(lookup),
    // Keep showing the last result while the next search runs, instead of flickering.
    placeholderData: keepPreviousData,
  });
  const duplicates = stillMatching(check.data, currentLookup);

  const [stage, setStage] = useState<'checking' | 'saving'>('checking');
  const save = useMutation({
    // Step 1: make sure nothing matches. Step 2: save. The server checks again while
    // saving, so two people adding the same lead at the same moment can't both succeed.
    mutationFn: async (lead: LeadInput) => {
      setStage('checking');
      const found = await queryClient.fetchQuery(duplicateCheckQuery(leadLookup(lead)));
      if (found.duplicates.length) {
        throw new ApiError('duplicate', 'Already in the sheet.', found.duplicates);
      }
      setStage('saving');
      return saveLead(lead);
    },
    // Try even when offline, so the caller gets an error now instead of a save that silently waits.
    networkMode: 'always',
    onSuccess: (result, lead) => {
      queryClient.setQueryData(statsQuery.queryKey, result);
      queryClient.removeQueries({ queryKey: ['duplicate-check'] });
      setForm(emptyForm(lead.addedBy));
      setErrors({});
      setSuccess(`Saved ${result.leadId} · ${lead.business}`);
    },
    onError: (err, lead) => {
      if (err instanceof ApiError && err.code === 'duplicate' && err.duplicates?.length) {
        const searched = leadLookup(lead);
        queryClient.setQueryData(duplicateCheckQuery(searched).queryKey, { lookup: searched, duplicates: err.duplicates });
        // The form is locked while saving, so it still holds what was sent.
        const found = duplicateErrors(err.duplicates, form.phones);
        setErrors(found);
        const first = fieldOrder(form).find((k) => found[k]);
        if (first) document.getElementById(first)?.focus();
      } else {
        setFailure(`${err.message} Your details are still here. Tap “Save lead” to try again.`);
      }
    },
  });

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  function clearError(key: ErrorKey) {
    setErrors(({ [key]: _, ...rest }) => rest);
    setSuccess('');
  }

  function update(key: TextField, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    clearError(key);
    if (key === 'addedBy') {
      try {
        localStorage.setItem(ADDED_BY_KEY, value);
      } catch {
        // Private browsing: the name just won't be remembered.
      }
    }
  }

  function updatePhone(i: number, value: string) {
    setForm((f) => ({ ...f, phones: f.phones.map((p, j) => (j === i ? value : p)) }));
    clearError(phoneKey(i));
  }

  function addPhone() {
    const i = form.phones.length;
    setForm((f) => ({ ...f, phones: [...f.phones, ''] }));
    requestAnimationFrame(() => document.getElementById(phoneKey(i))?.focus());
  }

  function removePhone(i: number) {
    setForm((f) => ({ ...f, phones: f.phones.filter((_, j) => j !== i) }));
    // The boxes below move up and may no longer be wrong (e.g. "already entered above"),
    // so their messages are cleared; saving checks them again.
    setErrors((e) =>
      Object.fromEntries(
        Object.entries(e).filter(([key]) => {
          const n = /^phone(\d+)$/.exec(key)?.[1];
          return n === undefined || Number(n) < i;
        }),
      ),
    );
    requestAnimationFrame(() => document.getElementById(phoneKey(i - 1))?.focus());
  }

  function errorProps(key: ErrorKey) {
    return {
      'aria-invalid': errors[key] ? true : undefined,
      'aria-describedby': errors[key] ? `${key}-error` : undefined,
    };
  }

  function field(key: TextField) {
    return {
      id: key,
      name: key,
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(key, e.target.value),
      ...errorProps(key),
    };
  }

  function phoneField(i: number) {
    const key = phoneKey(i);
    return {
      id: key,
      name: key,
      value: form.phones[i],
      onChange: (e: ChangeEvent<HTMLInputElement>) => updatePhone(i, e.target.value),
      type: 'tel',
      inputMode: 'tel' as const,
      autoComplete: 'off',
      ...errorProps(key),
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    setSuccess('');
    setFailure('');

    // A format problem wins over "already in the sheet" for the same field.
    const found = { ...duplicateErrors(duplicates, form.phones), ...validate(form) };
    setErrors(found);

    const firstInvalid = fieldOrder(form).find((k) => found[k]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    save.mutate(toLead(form));
  }

  return (
    <section className="panel" aria-labelledby="form-title">
      <div className="panel-head">
        <h2 id="form-title">Add a lead</h2>
      </div>

      <form className="lead-form" onSubmit={onSubmit} noValidate>
        <fieldset disabled={save.isPending}>
          <Field id="addedBy" label="Added by" required error={errors.addedBy}>
            <select {...field('addedBy')}>
              <option value="">Select your name</option>
              {CONFIG.TEAM.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>

          <Field id="business" label="Business / company name" required error={errors.business}>
            <input {...field('business')} type="text" autoComplete="off" autoCapitalize="words" />
          </Field>

          <div className="row-2">
            <Field id="contactName" label="Contact person name" required error={errors.contactName}>
              <input {...field('contactName')} type="text" autoComplete="off" autoCapitalize="words" />
            </Field>
            <Field id="designation" label="Designation" error={errors.designation}>
              <Select {...field('designation')} placeholder="Select designation" options={DESIGNATIONS} />
            </Field>
          </div>

          <div className="phones">
            <Field id={phoneKey(0)} label="Phone number" required error={errors.phone0} hint="10-digit mobile, +91 optional">
              <input {...phoneField(0)} placeholder="98765 43210" />
            </Field>

            {form.phones.slice(1).map((_, j) => {
              const i = j + 1;
              return (
                <Field key={i} id={phoneKey(i)} label={`Phone number ${i + 1}`} error={errors[phoneKey(i)]} hint="Mobile, or landline with STD code">
                  <div className="input-action">
                    <input {...phoneField(i)} placeholder="98765 43210 or 022 2345 6789" />
                    <button type="button" className="icon-btn" onClick={() => removePhone(i)} aria-label={`Remove phone number ${i + 1}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </Field>
              );
            })}

            {form.phones.length < CONFIG.MAX_PHONE_NUMBERS && (
              <button type="button" className="btn-add" onClick={addPhone}>
                + Add another number
              </button>
            )}
          </div>

          <div className="row-2">
            <Field id="email" label="Email" error={errors.email}>
              <input {...field('email')} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
            <Field id="socialLink" label="Instagram / Facebook" error={errors.socialLink}>
              <input {...field('socialLink')} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="instagram.com/…" />
            </Field>
          </div>

          {check.isFetching && !save.isPending && <Progress label="Searching the sheet for duplicates…" />}
          {check.isError && !check.isFetching && !save.isPending && (
            <p className="field-hint">Couldn’t search for duplicates right now. It will be checked again when you save.</p>
          )}

          {duplicates.length > 0 && (
            <div className="notice notice-error" role="alert">
              <strong>Already in the sheet, so it won't be added again</strong>
              {duplicates.map((d) => (
                <span key={d.leadId}>
                  Same {d.matchedOn.map((f) => matchLabel(d, f)).join(', ')} as {d.leadId}
                  {d.business ? ` · ${d.business}` : ''}, added by {d.addedBy} on {d.dateAdded}
                </span>
              ))}
            </div>
          )}

          <div className="row-2">
            <Field id="website" label="Website" error={errors.website}>
              <input {...field('website')} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="example.com" />
            </Field>
            <Field id="websitePitch" label="Pitch them a website?" required error={errors.websitePitch}>
              <Select {...field('websitePitch')} placeholder="Select" options={WEBSITE_PITCH} />
            </Field>
          </div>

          <Field id="websiteNotes" label="Website notes" error={errors.websiteNotes} hint="What to pitch, so the caller knows the angle">
            <textarea {...field('websiteNotes')} rows={2} placeholder="e.g. Not mobile-friendly, no enquiry form, last updated 2019" />
          </Field>

          <div className="row-2">
            <Field id="city" label="City" required error={errors.city}>
              <input {...field('city')} type="text" autoComplete="off" autoCapitalize="words" />
            </Field>
            <Field id="area" label="Area / locality" error={errors.area}>
              <input {...field('area')} type="text" autoComplete="off" autoCapitalize="words" placeholder="e.g. Andheri West" />
            </Field>
          </div>

          <div className="row-2">
            <Field id="businessType" label="Business type" required error={errors.businessType}>
              <Select {...field('businessType')} placeholder="Select type" options={BUSINESS_TYPES} />
            </Field>
            <Field id="leadSource" label="Lead source" required error={errors.leadSource}>
              <Select {...field('leadSource')} placeholder="Select source" options={LEAD_SOURCES} />
            </Field>
          </div>

          {form.leadSource === 'Other' && (
            <Field id="leadSourceOther" label="Specify lead source" required error={errors.leadSourceOther}>
              <input {...field('leadSourceOther')} type="text" autoComplete="off" placeholder="e.g. JustDial, walk-in" />
            </Field>
          )}

          <Field id="listingLink" label="Listing / profile link" error={errors.listingLink} hint="Where you found them, so the caller can mention it">
            <input {...field('listingLink')} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="99acres.com/…" />
          </Field>

          <Field id="notes" label="Notes for the caller" error={errors.notes}>
            <textarea {...field('notes')} rows={3} placeholder="e.g. 3 ongoing projects in Thane, ask for Rahul, busy before 11 am" />
          </Field>
        </fieldset>

        {save.isPending && (
          <Progress
            label={
              stage === 'checking'
                ? 'Step 1 of 2 · Searching the sheet for duplicates…'
                : 'Step 2 of 2 · No duplicates found. Saving the lead…'
            }
          />
        )}
        {failure && (
          <div className="notice notice-error" role="alert">
            <strong>Not saved</strong>
            <span>{failure}</span>
          </div>
        )}
        {success && (
          <div className="notice notice-success" role="status">
            <strong>Lead saved</strong>
            <span>{success}</span>
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>
          {save.isPending ? (
            <>
              <span className="spinner" aria-hidden="true" /> {stage === 'checking' ? 'Checking…' : 'Saving…'}
            </>
          ) : (
            'Save lead'
          )}
        </button>
      </form>
    </section>
  );
}

/** A search can't report how far along it is, so the bar keeps moving until it's done. */
function Progress({ label }: { label: string }) {
  return (
    <div className="progress" role="status">
      <div className="progress-track" aria-hidden="true">
        <span />
      </div>
      <p className="progress-label">{label}</p>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
};

function Field({ id, label, required, error, hint, children }: FieldProps) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="req"> *</span> : <span className="opt"> (optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

type SelectProps = ComponentProps<'select'> & { placeholder: string; options: string[] };

function Select({ placeholder, options, ...props }: SelectProps) {
  return (
    <select {...props}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
