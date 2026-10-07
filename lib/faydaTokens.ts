import crypto from 'crypto';
import { calculateSimilarity } from '@/lib/sanctionsScreening';
import type { IPersonVerification } from '@/lib/models/CorporateApplication';

// Who a person is comes from the Fayda backend: its signed eKYC result (data from Fayda) and its
// signed live face check. The dashboard asks the Fayda backend whether those signatures are its own
// instead of trusting what the browser sends — no shared secret needed.
const FAYDA_BACKEND_URL = process.env.FAYDA_BACKEND_URL || 'http://localhost:5000';
const ACTION_LABELS: Record<string, string> = { mouth: 'Open mouth', turn: 'Head turn' };

export const cleanBase64 = (s: unknown) => String(s || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
export const sha256Base64 = (s: unknown) => crypto.createHash('sha256').update(cleanBase64(s)).digest('hex');

export interface EkycPayload {
  t: 'ekyc';
  iat: number;
  fan?: string;
  uin?: string;
  name?: string;
  nameAmh?: string;
  dob?: string;
  gender?: string;
  phone?: string;
  email?: string;
  region?: string;
  zone?: string;
  woreda?: string;
  ph: string;                 // SHA-256 of the Fayda photo
}

interface FacePayload {
  iat: number;
  sh: string;                 // selfie hash
  fh: string;                 // Fayda photo hash the face was compared with
  fr: { a: string; h: string }[];
  liveness: any;
  match: any;
  matchError?: string;
}

/**
 * Whether an eKYC result is one the Fayda backend signed and still accepts — asked before taking
 * uploads, so only people who verified with Fayda can store files.
 */
export async function checkEkycToken(ekycToken: string): Promise<'valid' | 'invalid' | 'unavailable'> {
  return (await readEkycToken(ekycToken)).status;
}

/** The eKYC data the Fayda backend signed (who the representative is), if it still accepts it */
export async function readEkycToken(
  ekycToken: string
): Promise<{ status: 'valid'; ekyc: EkycPayload } | { status: 'invalid' | 'unavailable'; ekyc?: undefined }> {
  if (!ekycToken) return { status: 'invalid' };
  try {
    const res = await fetch(`${FAYDA_BACKEND_URL}/api/fayda/verify-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ekycToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
    return data.ekyc?.t === 'ekyc' ? { status: 'valid', ekyc: data.ekyc } : { status: 'invalid' };
  } catch (e: any) {
    console.error('[Corporate] eKYC check at the Fayda backend failed:', e.message);
    return { status: 'unavailable' };
  }
}

export interface IdentityInput {
  ekycToken: string;
  faceVerificationToken?: string;
  faydaPhoto: string;
  selfie: string;
  livenessFrames?: { action: string; image: string }[];
  faceVideoId?: string;
}

/** Verified identity of one person, or an error to show the customer */
export async function verifyIdentity(
  input: IdentityInput,
  enteredName = ''
): Promise<{ verification?: IPersonVerification; error?: string }> {
  if (!input.ekycToken) return { error: 'Verify your identity with Fayda first.' };
  if (!input.faydaPhoto || !input.selfie) return { error: 'The photos of the identity check are missing.' };

  let checked: { ekyc: EkycPayload | null; face: FacePayload | null; compare?: { match: any; matchError?: string } };
  try {
    const res = await fetch(`${FAYDA_BACKEND_URL}/api/fayda/verify-tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ekycToken: input.ekycToken,
        faceVerificationToken: input.faceVerificationToken || '',
        // only needed to compare the faces when there is no live-check result
        ...(input.faceVerificationToken ? {} : { selfie: input.selfie, faydaPhoto: input.faydaPhoto }),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
    checked = data;
  } catch (e: any) {
    console.error('[Corporate] Identity check at the Fayda backend failed:', e.message);
    return { error: 'We could not confirm the identity check right now. Please try again.' };
  }

  const ekyc = checked.ekyc;
  if (!ekyc || ekyc.t !== 'ekyc') return { error: 'The Fayda verification could not be confirmed. Please verify again.' };
  const photoHash = sha256Base64(input.faydaPhoto);
  if (ekyc.ph !== photoHash) return { error: 'The Fayda photo does not belong to this verification. Please verify again.' };

  const selfieHash = sha256Base64(input.selfie);
  const face = checked.face;
  let faceVerification: Record<string, any>;
  let livenessFrames: { action: string; label: string; image: string }[] = [];
  if (face && face.sh === selfieHash && face.fh === photoHash) {
    faceVerification = {
      verifiedBy: 'server', method: 'web-liveness-v1', checkedAt: new Date(face.iat).toISOString(),
      liveness: face.liveness, match: face.match, matchError: face.matchError,
    };
    livenessFrames = (input.livenessFrames || [])
      .filter(f => f && typeof f.image === 'string' && face.fr.some(x => x.a === f.action && x.h === sha256Base64(f.image)))
      .slice(0, 4)
      .map(f => ({ action: f.action, label: ACTION_LABELS[f.action] || f.action, image: cleanBase64(f.image) }));
  } else {
    faceVerification = {
      verifiedBy: 'server', method: 'compare-at-submission', checkedAt: new Date().toISOString(),
      match: checked.compare?.match ?? null, matchError: checked.compare?.matchError,
      liveness: {
        performed: false, passed: false,
        reason: input.faceVerificationToken
          ? 'The live check result does not belong to this verification'
          : 'The live camera check was not completed (camera check unavailable on the device)',
      },
    };
  }

  const fullName = (ekyc.name || '').toUpperCase();
  return {
    verification: {
      status: 'verified',
      verifiedAt: new Date(),
      fan: ekyc.fan || '',
      uin: ekyc.uin || '',
      fullName,
      fullNameAmharic: ekyc.nameAmh || '',
      dateOfBirth: ekyc.dob || '',
      gender: ekyc.gender || '',
      phone: ekyc.phone || '',
      email: ekyc.email || '',
      region: ekyc.region || '',
      zone: ekyc.zone || '',
      woreda: ekyc.woreda || '',
      photo: cleanBase64(input.faydaPhoto),
      selfie: cleanBase64(input.selfie),
      faceVerification,
      livenessFrames,
      faceVideoId: input.faceVideoId || '',
      nameMatchScore: enteredName ? calculateSimilarity(enteredName.toUpperCase(), fullName) : undefined,
    },
  };
}
