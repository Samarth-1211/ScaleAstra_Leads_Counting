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
import { BUSINESS_TYPES, CONFIG, DESIGNATIONS, LEAD_SOURCES, isConfigured } from '../config';
import { isValidEmail, normalizePhone } from '../phone';

type FormState = {
  addedBy: string;
  business: string;
  contactName: string;
  designation: string;
  phone: string;
  email: string;
  website: string;
  city: string;
  businessType: string;
  leadSource: string;
  leadSourceOther: string;
};
type Errors = Partial<Record<keyof FormState, string>>;

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

const emptyForm = (addedBy: string): FormState => ({
  addedBy,
  business: '',
  contactName: '',
  designation: '',
  phone: '',
  email: '',
  website: '',
  city: '',
  businessType: '',
  leadSource: '',
  leadSourceOther: '',
});

/** Fields top to bottom, so the first one with an error gets focus. */
const FIELD_ORDER = Object.keys(emptyForm('')) as (keyof FormState)[];

function validate(f: FormState): Errors {
  const e: Errors = {};
  if (!f.addedBy) e.addedBy = 'Select your name.';
  if (!f.business.trim()) e.business = 'Enter the business or company name.';
  if (!f.contactName.trim()) e.contactName = 'Enter the contact person’s name.';
  if (!f.phone.trim()) e.phone = 'Enter the phone number.';
  else if (!normalizePhone(f.phone)) e.phone = 'Enter a valid 10-digit mobile number, starting with 6, 7, 8 or 9.';
  if (f.email.trim() && !isValidEmail(f.email.trim())) e.email = 'Enter a valid email, like name@company.com.';
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
    .map((d) => ({ ...d, matchedOn: d.matchedOn.filter((f) => current[f] && current[f] === result.lookup[f]) }))
    .filter((d) => d.matchedOn.length > 0);
}

function duplicateErrors(duplicates: Duplicate[]): Errors {
  const e: Errors = {};
  for (const d of duplicates) for (const f of d.matchedOn) e[f] = DUPLICATE_ERRORS[f];
  return e;
}

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
    phone: normalizePhone(f.phone),
    email: f.email.trim(),
    website: f.website.trim(),
    city: f.city.trim(),
    businessType: f.businessType,
    leadSource: f.leadSource === 'Other' ? `Other: ${f.leadSourceOther.trim()}` : f.leadSource,
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
      const found = await queryClient.fetchQuery(duplicateCheckQuery(duplicateLookup(lead)));
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
        const searched = duplicateLookup(lead);
        queryClient.setQueryData(duplicateCheckQuery(searched).queryKey, { lookup: searched, duplicates: err.duplicates });
        const found = duplicateErrors(err.duplicates);
        setErrors(found);
        const first = FIELD_ORDER.find((k) => found[k]);
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

  function update(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors(({ [key]: _, ...rest }) => rest);
    setSuccess('');
    if (key === 'addedBy') {
      try {
        localStorage.setItem(ADDED_BY_KEY, value);
      } catch {
        // Private browsing: the name just won't be remembered.
      }
    }
  }

  function field(key: keyof FormState) {
    return {
      id: key,
      name: key,
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update(key, e.target.value),
      'aria-invalid': errors[key] ? true : undefined,
      'aria-describedby': errors[key] ? `${key}-error` : undefined,
    };
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.isPending) return;
    setSuccess('');
    setFailure('');

    // A format problem wins over "already in the sheet" for the same field.
    const found = { ...duplicateErrors(duplicates), ...validate(form) };
    setErrors(found);

    const firstInvalid = FIELD_ORDER.find((k) => found[k]);
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

          <div className="row-2">
            <Field id="phone" label="Phone number" required error={errors.phone} hint="10-digit mobile, +91 optional">
              <input {...field('phone')} type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input {...field('email')} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} />
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
                  Same {d.matchedOn.map((f) => DUPLICATE_LABELS[f]).join(', ')} as {d.leadId}
                  {d.business ? ` · ${d.business}` : ''}, added by {d.addedBy} on {d.dateAdded}
                </span>
              ))}
            </div>
          )}

          <div className="row-2">
            <Field id="website" label="Website" error={errors.website}>
              <input {...field('website')} type="text" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="example.com" />
            </Field>
            <Field id="city" label="City" required error={errors.city}>
              <input {...field('city')} type="text" autoComplete="off" autoCapitalize="words" />
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
