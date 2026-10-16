// How an account signs its comments. The API composes each form from what it holds about
// the account and offers only the ones it can build, so a missing family name simply
// leaves "given name and initial" out of the choices.
export const PUBLIC_NAME_STYLES = ["GIVEN_NAME_INITIAL", "FULL_NAME", "ALIAS"] as const;

export type PublicNameStyle = (typeof PUBLIC_NAME_STYLES)[number];

export type PublicName = {
  style: PublicNameStyle;
  alias: string | null;
  choices: Partial<Record<PublicNameStyle, string>>;
  // The name a comment sent now would carry; null until the account has one.
  current: string | null;
};

export const ALIAS_MIN_LENGTH = 2;
export const ALIAS_MAX_LENGTH = 40;
