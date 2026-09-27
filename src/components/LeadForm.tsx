import { useEffect, useState, type ChangeEvent, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, checkPhone, saveLead, statsQuery, type LeadInput } from '../api';
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

/** Returns errors in the same order as the fields, so the first one gets focus. */
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

  // Check for an existing lead as soon as a full, valid number is typed.
  const phoneDigits = normalizePhone(form.phone);
  const phoneCheck = useQuery({
    queryKey: ['phone-check', phoneDigits],
    queryFn: () => checkPhone(phoneDigits),
    enabled: isConfigured() && !!phoneDigits,
    staleTime: 60_000,
    retry: false,
  });
  const duplicate = phoneDigits ? (phoneCheck.data?.duplicate ?? null) : null;

  const save = useMutation({
    mutationFn: saveLead,
    // Try even when offline, so the caller gets an error now instead of a save that silently waits.
    networkMode: 'always',
    onSuccess: (result, lead) => {
      queryClient.setQueryData(statsQuery.queryKey, result);
      queryClient.removeQueries({ queryKey: ['phone-check'] });
      setForm(emptyForm(lead.addedBy));
      setErrors({});
      setSuccess(`Saved ${result.leadId} · ${lead.business}`);
    },
    onError: (err, lead) => {
      if (err instanceof ApiError && err.code === 'duplicate' && err.duplicate) {
        queryClient.setQueryData(['phone-check', lead.phone], { duplicate: err.duplicate });
        setErrors({ phone: 'This number is already in the sheet.' });
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

    const found = validate(form);
    if (!found.phone && duplicate) found.phone = 'This number is already in the sheet.';
    setErrors(found);

    const firstInvalid = Object.keys(found)[0];
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
            <Field
              id="phone"
              label="Phone number"
              required
              error={errors.phone}
              hint={phoneCheck.isFetching ? 'Checking the sheet…' : '10-digit mobile, +91 optional'}
            >
              <input {...field('phone')} type="tel" inputMode="tel" autoComplete="off" placeholder="98765 43210" />
            </Field>
            <Field id="email" label="Email" error={errors.email}>
              <input {...field('email')} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </Field>
          </div>

          {duplicate && (
            <div className="notice notice-error" role="alert">
              <strong>Already in the sheet, so it won't be added again</strong>
              <span>
                Added by {duplicate.addedBy} on {duplicate.dateAdded}
                {duplicate.business ? ` · ${duplicate.business}` : ''} ({duplicate.leadId})
              </span>
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
              <span className="spinner" aria-hidden="true" /> Saving…
            </>
          ) : (
            'Save lead'
          )}
        </button>
      </form>
    </section>
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
