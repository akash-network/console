const MIN_GENERATED_TAG_LENGTH = 5;
/** From this length on, any mix of letters and digits counts as generated, as it did before shorter tags were judged. */
const MIN_ALWAYS_GENERATED_MIXED_TAG_LENGTH = 8;
/** Shorter runs of letters are acronyms such as gpu or aws more often than words, so they are not judged. */
const MIN_JUDGED_LETTERS_LENGTH = 4;
const ALPHANUMERIC = /^[a-z0-9]+$/;
const LETTER = /[a-z]/;
const DIGIT = /\d/;
const TRAILING_NUMBER = /\d+$/;

/** The 226 letter pairs rarest in English words, so a tag holding one reads as random letters and one such as `akash` or `news` does not. */
const LETTER_PAIRS_ENGLISH_WORDS_AVOID: ReadonlySet<string> = new Set(
  (
    "bf bg bk bq bw bx bz cb cd cf cg cj cm cp cq cv cw cx cz dk dq dt dx dz fb fc fd fg fh fj fk fm fn fp fq fs fv fw fx fz gc gf gj gk " +
    "gp gq gv gx gz hc hg hh hj hk hq hv hx hz iy jb jc jd jf jg jh jj jk jl jm jn jp jq jr js jt jv jw jx jy jz kc kd kg kj kk kp kq kv " +
    "kx kz lj lq lx lz mc md mg mh mj mk mq mr mt mv mw mx mz nx pd pg pj pk pq pv px pz qa qb qc qd qe qf qg qh qi qj qk ql qm qn qo qp " +
    "qq qr qs qt qv qw qx qy qz rx rz sj sv sx sz tj tk tq tv tx uh uj uq uu uw vb vc vd vf vg vh vj vk vl vm vn vp vq vr vs vt vv vw vx " +
    "vz wc wg wj wp wq wu wv ww wx wz xb xd xf xg xj xk xl xm xn xq xr xs xv xw xx xz yj yk yq yv yy zb zc zd zf zg zh zj zk zm zn zp zq " +
    "zr zs zt zv zw zx"
  ).split(" ")
);

export function hasGeneratedPlusTag(email: string | null | undefined): boolean {
  const tag = extractPlusTag(email)?.toLowerCase();
  if (!tag || tag.length < MIN_GENERATED_TAG_LENGTH) return false;
  if (!ALPHANUMERIC.test(tag) || !LETTER.test(tag)) return false;
  if (DIGIT.test(tag) && tag.length >= MIN_ALWAYS_GENERATED_MIXED_TAG_LENGTH) return true;

  const lettersBeforeNumber = tag.replace(TRAILING_NUMBER, "");

  return DIGIT.test(lettersBeforeNumber) || !readsAsWord(lettersBeforeNumber);
}

function readsAsWord(letters: string): boolean {
  if (letters.length < MIN_JUDGED_LETTERS_LENGTH) return true;

  return !listLetterPairs(letters).some(pair => LETTER_PAIRS_ENGLISH_WORDS_AVOID.has(pair));
}

function listLetterPairs(letters: string): string[] {
  return Array.from({ length: letters.length - 1 }, (_, index) => letters.slice(index, index + 2));
}

function extractPlusTag(email: string | null | undefined): string | null {
  if (!email) return null;

  const separatorIndex = email.lastIndexOf("@");
  if (separatorIndex === -1) return null;

  const localPart = email.slice(0, separatorIndex);
  const tagStart = localPart.indexOf("+");

  return tagStart === -1 ? null : localPart.slice(tagStart + 1);
}
